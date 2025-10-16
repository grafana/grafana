package hardcoded

import (
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

func TestdataOpenAPIExtension() (*datasourceV0.DataSourceOpenAPIExtension, error) {
	oas := &datasourceV0.DataSourceOpenAPIExtension{
		SecureValues: []datasourceV0.SecureValueInfo{ // empty
			// {
			// 	Key:         "aaa",
			// 	Description: "describe aaa",
			// 	Required:    true,
			// }, {
			// 	Key:         "bbb",
			// 	Description: "describe bbb",
			// },
		},
	}

	// Dummy spec
	p := &spec.Schema{} //SchemaProps: spec.SchemaProps{Type: []string{"object"}}}
	p.Description = "Test data does not require any explicit configuration"
	p.Required = []string{}
	p.AdditionalProperties = &spec.SchemaOrBool{Allows: false}
	p.Properties = map[string]spec.Schema{
		"url": *spec.StringProperty().WithDescription("not used"),
	}
	p.Example = map[string]any{
		"url": "http://xxxx",
	}
	oas.DataSourceSpec = p

	// Resource routes
	// https://github.com/grafana/grafana/blob/main/pkg/tsdb/grafana-testdata-datasource/resource_handler.go#L20
	unstructured := spec.MapProperty(nil)
	unstructuredResponse := &spec3.Responses{
		ResponsesProps: spec3.ResponsesProps{
			Default: &spec3.Response{
				ResponseProps: spec3.ResponseProps{
					Content: map[string]*spec3.MediaType{
						"application/json": {
							MediaTypeProps: spec3.MediaTypeProps{
								Schema: unstructured,
							},
						},
					},
				},
			},
		},
	}
	unstructuredRequest := &spec3.RequestBody{
		RequestBodyProps: spec3.RequestBodyProps{
			Content: map[string]*spec3.MediaType{
				"application/json": {
					MediaTypeProps: spec3.MediaTypeProps{
						Schema: unstructured,
					},
				},
			},
		},
	}

	oas.Routes = map[string]*spec3.Path{
		"": {
			PathProps: spec3.PathProps{
				Summary: "hello world",
				Get: &spec3.Operation{
					OperationProps: spec3.OperationProps{
						Responses: &spec3.Responses{
							ResponsesProps: spec3.ResponsesProps{
								Default: &spec3.Response{
									ResponseProps: spec3.ResponseProps{
										Content: map[string]*spec3.MediaType{
											"text/plain": {
												MediaTypeProps: spec3.MediaTypeProps{
													Schema: spec.StringProperty(),
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
		"/scenarios": {
			PathProps: spec3.PathProps{
				Summary: "hello world",
				Get: &spec3.Operation{
					OperationProps: spec3.OperationProps{
						Responses: unstructuredResponse,
					},
				},
			},
		},
		"/stream": {
			PathProps: spec3.PathProps{
				Summary: "Get streaming response",
				Get: &spec3.Operation{
					OperationProps: spec3.OperationProps{
						Parameters: []*spec3.Parameter{
							{
								ParameterProps: spec3.ParameterProps{
									Name:        "count",
									In:          "query",
									Schema:      spec.Int64Property(),
									Description: "number of points that will be returned",
									Example:     10,
								},
							},
							{
								ParameterProps: spec3.ParameterProps{
									Name:        "start",
									In:          "query",
									Schema:      spec.Int64Property(),
									Description: "the start value",
								},
							},
							{
								ParameterProps: spec3.ParameterProps{
									Name:        "flush",
									In:          "query",
									Schema:      spec.Int64Property(),
									Description: "How often the result is flushed (1-100%)",
									Example:     100,
								},
							},
							{
								ParameterProps: spec3.ParameterProps{
									Name:        "speed",
									In:          "query",
									Schema:      spec.StringProperty(),
									Description: "the clock cycle",
									Example:     "100ms",
								},
							},
							{
								ParameterProps: spec3.ParameterProps{
									Name:        "format",
									In:          "query",
									Schema:      spec.StringProperty().WithEnum("json", "influx"),
									Description: "the response format",
								},
							},
						},
						Responses: unstructuredResponse,
					},
				},
			},
		},
		"/boom": {
			PathProps: spec3.PathProps{
				Summary: "force a panic",
				Get: &spec3.Operation{
					OperationProps: spec3.OperationProps{
						Responses: unstructuredResponse,
					},
				},
				Post: &spec3.Operation{
					OperationProps: spec3.OperationProps{
						Responses: unstructuredResponse,
					},
				},
			},
		},
		"/test": {
			PathProps: spec3.PathProps{
				Summary: "Echo any request",
				Post: &spec3.Operation{
					OperationProps: spec3.OperationProps{
						RequestBody: unstructuredRequest,
						Responses:   unstructuredResponse,
					},
				},
			},
		},
		"/sims": {
			PathProps: spec3.PathProps{
				Description: "Get list of simulations",
				Get: &spec3.Operation{
					OperationProps: spec3.OperationProps{
						Responses: unstructuredResponse,
					},
				},
			},
		},
		"/sim/{key}": {
			PathProps: spec3.PathProps{
				Description: "Get list of simulations",
				Get: &spec3.Operation{
					OperationProps: spec3.OperationProps{
						Parameters: []*spec3.Parameter{
							{
								ParameterProps: spec3.ParameterProps{
									Name:        "key",
									In:          "path",
									Description: "simulation key (should include hz)",
								},
							},
						},
						Responses: unstructuredResponse,
					},
				},
				Post: &spec3.Operation{
					OperationProps: spec3.OperationProps{
						Parameters: []*spec3.Parameter{
							{
								ParameterProps: spec3.ParameterProps{
									Name:        "key",
									In:          "path",
									Description: "simulation key (should include hz)",
								},
							},
						},
						RequestBody: unstructuredRequest,
						Responses:   unstructuredResponse,
					},
				},
			},
		},
	}

	// Duplicate the test route (but with a new path)
	testcopy := *oas.Routes["/test"]
	oas.Routes["/test/json"] = &testcopy

	return oas, nil
}
