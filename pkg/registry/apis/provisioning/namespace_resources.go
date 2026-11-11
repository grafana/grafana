package provisioning

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/sets"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// handleNamespaceResources answers "what is in this namespace, and who manages it".
//
// The search index is read with the caller's own identity, so an end user sees the
// rows RBAC lets them see while the operators' service identity sees all of them.
func (b *APIBuilder) handleNamespaceResources(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	u, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		errhttp.Write(ctx, apierrors.NewBadRequest("expected user"), w)
		return
	}

	opts, err := parseNamespaceListOptions(r.URL.Query())
	if err != nil {
		errhttp.Write(ctx, apierrors.NewBadRequest(err.Error()), w)
		return
	}

	list, err := b.namespaceLister.ListNamespace(ctx, u.GetNamespace(), opts)
	if err := resource.StatusErrorFromGRPC(err); err != nil {
		errhttp.Write(ctx, err, w)
		return
	}
	list.APIVersion = b.gv.String()
	list.Kind = "ResourceList"
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(list)
}

// parseNamespaceListOptions reads the query parameters of the namespace resources
// route. Every unparseable or unknown value is rejected rather than ignored: a filter
// silently dropped would answer a different question from the one asked.
func parseNamespaceListOptions(query map[string][]string) (resources.NamespaceListOptions, error) {
	get := func(key string) string {
		if values := query[key]; len(values) > 0 {
			return strings.TrimSpace(values[0])
		}
		return ""
	}

	opts := resources.NamespaceListOptions{
		ManagerKind: get("manager.kind"),
		ManagerID:   get("manager.id"),
		Group:       get("group"),
		Resource:    get("resource"),
		Continue:    get("continue"),
	}

	if raw := get("managed"); raw != "" {
		managed, err := strconv.ParseBool(raw)
		if err != nil {
			return opts, fmt.Errorf("invalid managed %q: expected true or false", raw)
		}
		opts.Managed = &managed
	}

	if raw := get("limit"); raw != "" {
		limit, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || limit < 0 {
			return opts, fmt.Errorf("invalid limit %q: expected a non-negative number", raw)
		}
		opts.Limit = limit
	}

	if raw := get("fields"); raw != "" {
		opts.Fields = sets.New[string]()
		for _, field := range strings.Split(raw, ",") {
			field = strings.TrimSpace(field)
			if field == "" {
				continue
			}
			if !resources.ProjectableFields.Has(field) {
				return opts, fmt.Errorf("invalid fields %q: expected %s",
					field, strings.Join(sets.List(resources.ProjectableFields), ", "))
			}
			opts.Fields.Insert(field)
		}
	}

	return opts, nil
}

// namespaceResourcesRouteSpec describes the namespace resources route for the OpenAPI
// description. The route is served directly, so nothing else derives its parameters.
func namespaceResourcesRouteSpec() *spec3.PathProps {
	queryParam := func(name, description string, example any, schema *spec.Schema) *spec3.Parameter {
		return &spec3.Parameter{
			ParameterProps: spec3.ParameterProps{
				Name:        name,
				In:          "query",
				Description: description,
				Example:     example,
				Schema:      schema,
			},
		}
	}
	stringParam := func(name, description, example string) *spec3.Parameter {
		return queryParam(name, description, example, spec.StringProperty())
	}

	return &spec3.PathProps{
		Get: &spec3.Operation{
			OperationProps: spec3.OperationProps{
				OperationId: "listNamespaceResources", // used for RTK client
				Tags:        []string{"Provisioning", "Repository"},
				Description: "List the resources in this namespace and what manages each one",
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
					stringParam("manager.kind", "Restrict to resources managed by this kind of manager", "repo"),
					stringParam("manager.id", "Restrict to resources managed by this manager", "my-repository"),
					queryParam("managed", "Restrict to managed (true) or unmanaged (false) resources", false, spec.BooleanProperty()),
					stringParam("group", "Restrict to resources in this API group", "dashboard.grafana.app"),
					stringParam("resource", "Restrict to this plural resource name", "dashboards"),
					queryParam("limit", "Maximum number of items in one page", 500, spec.Int64Property()),
					stringParam("continue", "Continue token from a previous page", ""),
					stringParam("fields", "Comma-separated optional fields to include: path, hash, time", "path,hash"),
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
														Ref: spec.MustCreateRef("#/components/schemas/" + provisioning.ResourceList{}.OpenAPIModelName()),
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
	}
}
