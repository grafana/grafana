package display

import (
	"encoding/json"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	authlib "github.com/grafana/authlib/types"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// CurrentUserName is the name token that denotes the calling identity in the "who am I" endpoint.
const CurrentUserName = "~"

// currentUserPath is the route path for the "who am I" endpoint.
const currentUserPath = "users/" + CurrentUserName

// selfRouteSpec describes the current-user endpoint for OpenAPI discovery.
func (r *DisplayHandler) selfRouteSpec() *spec3.PathProps {
	return &spec3.PathProps{
		Get: &spec3.Operation{
			OperationProps: spec3.OperationProps{
				OperationId: "getCurrentUserDisplay",
				Tags:        []string{"Display"},
				Description: "Show display information for the currently authenticated identity",
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
														Ref: spec.MustCreateRef("#/components/schemas/" + iam.Display{}.OpenAPIModelName()),
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

// handleSelf resolves the display information for the caller derived from the request context
func (r *DisplayHandler) handleSelf(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	authInfo, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		errhttp.Write(ctx, apierrors.NewUnauthorized("missing auth info"), w)
		return
	}

	ns, err := authlib.ParseNamespace(authInfo.GetNamespace())
	if err != nil {
		errhttp.Write(ctx, apierrors.NewBadRequest("missing namespace"), w)
		return
	}

	// GetUID() is already in the "<type>:<identifier>" form the resolvers expect
	// (e.g. "user:u000000001"), so the caller identifies itself purely from context.
	key := authInfo.GetUID()

	for _, p := range r.resolvers {
		partial, err := p.GetDisplayList(ctx, ns, []string{key})
		if err != nil {
			errhttp.Write(ctx, fmt.Errorf("error calling GetDisplayList %w", err), w) // 500
			return
		}
		if len(partial.Items) > 0 {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(partial.Items[0])
			return
		}
	}

	errhttp.Write(ctx, apierrors.NewNotFound(iam.Resource("users"), authInfo.GetIdentifier()), w)
}
