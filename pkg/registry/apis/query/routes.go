package query

import (
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	queryV1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

func (b *QueryAPIBuilder) GetAPIRoutes(gv schema.GroupVersion) *builder.APIRoutes {
	defs := b.GetOpenAPIDefinitions()(func(path string) spec.Ref { return spec.Ref{} })
	sqlSchemas := defs[queryV1.OpenAPIPrefix+"QueryResponseSQLSchemas"].Schema
	routes := &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{Path: "query",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Tags:        []string{"Query"},
							OperationId: "queryDatasources",
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
																	Ref: spec.MustCreateRef("#/components/schemas/com.github.grafana.grafana.pkg.apis.datasource.v0alpha1.QueryDataResponse"),
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
				Handler: b.QueryDatasources,
			},
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
		Handler: b.GetConnections,
	})
	return routes
}
