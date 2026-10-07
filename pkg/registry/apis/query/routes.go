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
						Tags:        []string{"Query"},
						OperationId: "queryDatasources",
						Parameters: []*spec3.Parameter{
							{
								Name:        "namespace",
								In:          "path",
								Required:    true,
								Example:     "default",
								Description: "workspace",
								Schema:      spec.StringProperty(),
							},
						},
						Responses: &spec3.Responses{
							StatusCodeResponses: map[int]*spec3.Response{
								200: {
									ResponseProps: spec3.ResponseProps{
										Content: map[string]*spec3.MediaType{
											"application/json": {
												MediaTypeProps: spec3.MediaTypeProps{
													Schema: &spec.Schema{
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
				Handler: b.QueryDatasources,
			},
			{
				Path: "query/sqlschemas",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{
						Tags:        []string{"Query"},
						OperationId: "querySQLSchemas",
						Description: "Send the same request you would send to /query, and get a schema that will represent the response",
						Parameters: []*spec3.Parameter{
							{
								Name:        "namespace",
								In:          "path",
								Required:    true,
								Example:     "default",
								Description: "workspace",
								Schema:      spec.StringProperty(),
							},
						},
						Responses: &spec3.Responses{
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
				Handler: b.GetSQLSchemas,
			},
		},
	}

	searchResults := defs[queryV1.OpenAPIPrefix+"DataSourceConnectionList"].Schema
	routes.Namespace = append(routes.Namespace, builder.APIRouteHandler{
		Path: "connections",
		Spec: &spec3.PathProps{
			Get: &spec3.Operation{
				Tags:        []string{"Connections"},
				OperationId: "listDataSourceConnections",
				Description: "List data source connections across all types",
				Parameters: []*spec3.Parameter{
					{
						Name:        "namespace",
						In:          "path",
						Required:    true,
						Example:     "default",
						Description: "workspace",
						Schema:      spec.StringProperty(),
					},
					{
						Name:        "name",
						In:          "query",
						Description: "datasource name (UID in legacy grafana APIs)",
						Required:    false,
						Schema:      spec.StringProperty(),
					},
					{
						Name:        "limit",
						In:          "query",
						Description: "Maximum number of connections to return; zero means no limit (server side maximum applies)",
						Schema:      spec.Int64Property(),
					},
					{
						Name:        "continue",
						In:          "query",
						Description: "Continuation token from the previous page",
						Schema:      spec.StringProperty(),
					},
				},
				Responses: &spec3.Responses{
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
		Handler: b.GetConnections,
	})
	return routes
}
