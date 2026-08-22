package useractions

import (
	"encoding/json"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// RoutePath is the route, and the resource name it is authorized as.
const RoutePath = "userActions"

// Handler serves the caller's RBAC actions as a map of action -> true, matching
// the legacy /api/access-control/user/actions endpoint.
type Handler struct {
	provider RolePermissionProvider
}

func NewHandler(provider RolePermissionProvider) *Handler {
	return &Handler{provider: provider}
}

func (h *Handler) GetAPIRoutes(_ map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: RoutePath,
				Spec: &spec3.PathProps{
					Get: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							OperationId: "getUserActions", // This is used by RTK client generator
							Tags:        []string{"UserActions"},
							Description: "Returns the RBAC actions granted to the calling user, as a map of action to true.",
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
										Name:        "reloadcache",
										In:          "query",
										Required:    false,
										Description: "Resolve permissions afresh rather than serving a cached set",
										Schema:      spec.BooleanProperty(),
									},
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									StatusCodeResponses: map[int]*spec3.Response{
										200: {
											ResponseProps: spec3.ResponseProps{
												Description: "Map of RBAC action to true",
												Content: map[string]*spec3.MediaType{
													"application/json": {
														MediaTypeProps: spec3.MediaTypeProps{
															Schema: spec.MapProperty(spec.BooleanProperty()),
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
				Handler: h.handle,
			},
		},
	}
}

func (h *Handler) handle(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		errhttp.Write(ctx, apierrors.NewUnauthorized("no identity found"), w)
		return
	}

	// reloadcache mirrors the legacy endpoint, which the frontend uses to pick up
	// its own permission changes straight after a mutation.
	opts := Options{ReloadCache: req.URL.Query().Get("reloadcache") == "true"}

	actions, err := h.provider.ActionsForUser(ctx, requester, opts)
	if err != nil {
		errhttp.Write(ctx, err, w)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(actions)
}
