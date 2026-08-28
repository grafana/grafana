package connections

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// RoutePath is the namespaced path the connections list is served on.
const RoutePath = "connections"

// Routes returns the namespaced route handlers for listing datasource
// connections across every plugin type.
func Routes(store datasourceV0.DataSourceConnectionProvider, defs map[string]common.OpenAPIDefinition) []builder.APIRouteHandler {
	listSchema := defs[datasourceV0.OpenAPIPrefix+"DataSourceConnectionList"].Schema
	return []builder.APIRouteHandler{{
		Path: RoutePath,
		Spec: &spec3.PathProps{
			Get: &spec3.Operation{
				OperationProps: spec3.OperationProps{
					Tags:        []string{"Connections"},
					OperationId: "listDataSourceConnections",
					Description: "List data source connections across all types",
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
								Name:        "name",
								In:          "query",
								Description: "datasource name (UID in legacy grafana APIs)",
								Required:    false,
								Schema:      spec.StringProperty(),
							},
						},
						{
							ParameterProps: spec3.ParameterProps{
								Name:        "plugin",
								In:          "query",
								Description: "plugin identifier",
								Required:    false,
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
													Schema: &listSchema,
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
		Handler: listHandler(store),
	}}
}

func listHandler(store datasourceV0.DataSourceConnectionProvider) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx := r.Context()

		namespace := mux.Vars(r)["namespace"]
		if namespace == "" {
			errhttp.Write(ctx, apierrors.NewBadRequest("namespace is required"), w)
			return
		}
		// The multi-tenant database provider resolves the stack from the
		// namespace on the context, so it has to be set before the store runs.
		ctx = request.WithNamespace(ctx, namespace)

		query := r.URL.Query()
		list, err := store.ListConnections(ctx, datasourceV0.DataSourceConnectionQuery{
			Namespace: namespace,
			Name:      query.Get("name"),
			Plugin:    query.Get("plugin"),
		})
		if err != nil {
			errhttp.Write(ctx, err, w)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(list); err != nil {
			errhttp.Write(ctx, err, w)
		}
	}
}
