package externalgroupmapping

import (
	"fmt"
	"net/http"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/util/errhttp"
	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"
)

var _ SearchHandler = (*NoopSearchREST)(nil)

type NoopSearchREST struct{}

func ProvideNoopSearchREST() *NoopSearchREST {
	return &NoopSearchREST{}
}

func (n *NoopSearchREST) GetAPIRoutes(defs map[string]common.OpenAPIDefinition) *builder.APIRoutes {
	searchResults := defs["github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1.ExternalGroupMappingList"].Schema
	return &builder.APIRoutes{
		Namespace: []builder.APIRouteHandler{
			{
				Path: "searchExternalGroupMappings",
				Spec: &spec3.PathProps{
					Post: &spec3.Operation{
						OperationProps: spec3.OperationProps{
							Description: "External Group Mapping search",
							Tags:        []string{"Search"},
							OperationId: "searchExternalGroupMappings",
							RequestBody: &spec3.RequestBody{
								RequestBodyProps: spec3.RequestBodyProps{
									Content: map[string]*spec3.MediaType{
										"application/json": {
											MediaTypeProps: spec3.MediaTypeProps{
												Schema: &spec.Schema{
													SchemaProps: spec.SchemaProps{
														Type: []string{"object"},
														Properties: map[string]spec.Schema{
															"externalGroups": {
																SchemaProps: spec.SchemaProps{
																	Type: []string{"array"},
																	Items: &spec.SchemaOrArray{
																		Schema: &spec.Schema{
																			SchemaProps: spec.SchemaProps{
																				Type: []string{"string"},
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
										Name:        "teamName",
										In:          "query",
										Required:    false,
										Description: "Team name",
										Schema:      spec.StringProperty(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "limit",
										In:          "query",
										Description: "number of results to return",
										Example:     30,
										Required:    false,
										Schema:      spec.Int64Property(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "page",
										In:          "query",
										Description: "page number (starting from 1)",
										Example:     1,
										Required:    false,
										Schema:      spec.Int64Property(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "offset",
										In:          "query",
										Description: "number of results to skip",
										Example:     0,
										Required:    false,
										Schema:      spec.Int64Property(),
									},
								},
								{
									ParameterProps: spec3.ParameterProps{
										Name:        "sort",
										In:          "query",
										Description: "sortable field",
										Example:     "",
										Examples: map[string]*spec3.Example{
											"externalGroup": {
												ExampleProps: spec3.ExampleProps{
													Summary: "externalGroup ascending",
													Value:   "externalGroup",
												},
											},
											"-externalGroup": {
												ExampleProps: spec3.ExampleProps{
													Summary: "externalGroup descending",
													Value:   "-externalGroup",
												},
											},
										},
										Required: false,
										Schema:   spec.StringProperty(),
									},
								},
							},
							Responses: &spec3.Responses{
								ResponsesProps: spec3.ResponsesProps{
									Default: &spec3.Response{
										ResponseProps: spec3.ResponseProps{
											Description: "Default OK response",
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
				Handler: n.doSearch,
			},
		},
	}
}

func (n *NoopSearchREST) doSearch(w http.ResponseWriter, r *http.Request) {
	errhttp.Write(r.Context(), errors.NewForbidden(iamv0.ExternalGroupMappingResourceInfo.GroupResource(), "", fmt.Errorf("functionality not available")), w)
}
