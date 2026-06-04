package display

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

type Resolver interface {
	GetDisplayList(ctx context.Context, ns authlib.NamespaceInfo, keys []string) (*iam.DisplayList, error)
}

type DisplayHandler struct {
	resolvers []Resolver
}

// NewDisplayHandler creates a new DisplayHandler with the given resolvers.
// We have multiple resolvers to allow the transition from SQL to search
func NewDisplayHandler(resolvers ...Resolver) *DisplayHandler {
	return &DisplayHandler{resolvers}
}

func (r *DisplayHandler) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "display",
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "getDisplayMapping", // This is used by RTK client generator
							Tags:        []string{"Display"},
							Description: "Show user display information",
							Parameters: []*spec3.Parameter{
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "namespace",
										In:          "path",
										Required:    true,
										Example:     "default",
										Description: "workspace",
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "key",
										In:          "query",
										Description: "Display keys",
										Required:    true,
										Example:     "user:u000000001",
										Schema:      spec.ArrayProperty(spec.StringProperty()),
										//	Style:       "form",
										Explode: true,
									},
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: &spec.Schema{
																SchemaProps: spec.SchemaProps{
																	Ref: spec.MustCreateRef("#/components/schemas/" + iam.DisplayList{}.OpenAPIModelName()),
																},
															},
														},
													},
												},
											},
										},
									},
								},
							},
						},
					},
				},
				Handler: r.handleDisplay,
			},
		},
	}
}

func (r *DisplayHandler) handleDisplay(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	user, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		errhttp.Write(ctx, apierrors.NewUnauthorized("missing auth info"), w)
		return
	}

	ns, err := authlib.ParseNamespace(user.GetNamespace())
	if err != nil {
		errhttp.Write(ctx, apierrors.NewBadRequest("missing namespace"), w)
		return
	}

	keys := req.URL.Query()["key"]
	if len(keys) == 0 {
		errhttp.Write(ctx, apierrors.NewBadRequest("missing key"), w)
		return
	}

	rsp := &iam.DisplayList{Keys: keys}
	seen := make(map[string]struct{}, len(keys))
	pending := keys
	for _, p := range r.resolvers {
		if len(pending) == 0 {
			break
		}
		partial, err := p.GetDisplayList(ctx, ns, pending)
		if err != nil {
			errhttp.Write(ctx, fmt.Errorf("error calling GetDisplayList %w", err), w) // 500
			return
		}

		// When only one provider exists, we can skip it
		// NOTE when everything is mode5, this will always be the case
		if len(r.resolvers) == 1 {
			rsp = partial
			break
		}

		// Providers re-parse the same input independently, so they emit the
		// same InvalidKeys; record once from the first non-empty response.
		if rsp.InvalidKeys == nil {
			rsp.InvalidKeys = partial.InvalidKeys
		}
		for _, item := range partial.Items {
			sig := identitySignature(item)
			if _, dup := seen[sig]; dup {
				continue
			}
			seen[sig] = struct{}{}
			rsp.Items = append(rsp.Items, item)
		}
		pending = unresolvedKeys(keys, rsp.Items, rsp.InvalidKeys)
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(rsp)
}

// identitySignature returns a stable key for deduping Display entries across
// providers. Two entries refer to the same identity when their type and name
// match (terminal entries like "anonymous:" use the same empty name).
func identitySignature(d iam.Display) string {
	return string(d.Identity.Type) + "/" + d.Identity.Name
}

// unresolvedKeys returns the subset of input keys not yet covered by items or
// already known to be invalid. Used to narrow the work passed to subsequent
// providers in the chain.
func unresolvedKeys(allKeys []string, items []iam.Display, invalidKeys []string) []string {
	if len(allKeys) == 0 {
		return nil
	}
	invalid := make(map[string]struct{}, len(invalidKeys))
	for _, k := range invalidKeys {
		invalid[k] = struct{}{}
	}
	pending := make([]string, 0, len(allKeys))
	for _, k := range allKeys {
		if _, bad := invalid[k]; bad {
			continue
		}
		if keySatisfiedByItems(k, items) {
			continue
		}
		pending = append(pending, k)
	}
	return pending
}

// keySatisfiedByItems reports whether some entry in items represents the given
// input key. Mirrors the parsing rules in parseKeys so we can recognize a hit
// without re-implementing the dispatch.
func keySatisfiedByItems(rawKey string, items []iam.Display) bool {
	key := rawKey
	var requiredType authlib.IdentityType
	hasType := false
	if idx := strings.Index(key, ":"); idx > 0 {
		t, err := authlib.ParseType(key[:idx])
		if err != nil {
			// Unparseable prefix is handled via InvalidKeys, not retried.
			return true
		}
		requiredType = t
		hasType = true
		key = key[idx+1:]
	}

	id, intErr := strconv.ParseInt(key, 10, 64)
	isInt := intErr == nil

	for _, d := range items {
		if hasType && d.Identity.Type != requiredType {
			continue
		}
		// type-only keys (e.g. "anonymous:") match by type alone.
		if key == "" {
			return true
		}
		if d.Identity.Name == key {
			return true
		}
		// Numeric keys resolve via the internal id; skip id 0 since it is the
		// sentinel for the "System admin" terminal which matches by Name above.
		if isInt && id != 0 && d.InternalID == id {
			return true
		}
	}
	return false
}
