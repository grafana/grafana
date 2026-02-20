package query

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	queryV1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func (b *QueryAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	sqlSchemas := defs[queryV1.OpenAPIPrefix+"QueryResponseSQLSchemas"].Schema
	routes := &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "query/sqlschemas",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"Query"},
							OperationId: "querySQLSchemas",
							Description: "Send the same request you would send to /query, and get a schema that will represent the response",
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
															Schema: &sqlSchemas,
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
				Handler: b.GetSQLSchemas,
			},
		},
	}

	// Get a list of all datasource instances
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !b.features.IsEnabledGlobally(featuremgmt.FlagQueryServiceWithConnections) {
		return routes
	}

	searchResults := defs[queryV1.OpenAPIPrefix+"DataSourceConnectionList"].Schema
	routes.Namespace = append(routes.Namespace, builder.APIRouteHandler{
		Path: "connections",
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
													Schema: &searchResults,
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
		Handler: func(w http.ResponseWriter, r *http.Request) {
			query := r.URL.Query()
			list, err := b.connections.ListConnections(r.Context(), queryV1.DataSourceConnectionQuery{
				Namespace: mux.Vars(r)["namespace"],
				Name:      query.Get("name"),
				Plugin:    query.Get("plugin"),
			})
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			encoder := json.NewEncoder(w)
			encoder.SetIndent("", "  ") // pretty print
			if err := encoder.Encode(list); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
		},
	})
	return routes
}
