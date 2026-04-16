package kinds

import (
	"testing"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
)

const pluginDirectory = "../../../../public/app/plugins/datasource/grafana-testdata-datasource/"

func TestUpdateSchema(t *testing.T) {
	schema := &pluginschema.PluginSchema{
		APIVersion:       "v0alpha1",
		SettingsSchema:   Settings(),
		SettingsExamples: SettingsExamples(),
		Routes:           Routes(),
	}

	pluginschema.UpdateSchema(t, schema, pluginDirectory+"schema")
}

func Settings() *pluginschema.Settings {
	v := &pluginschema.Settings{
		Spec:         &spec.Schema{},
		SecureValues: nil, // none
	}

	// Dummy spec
	p := v.Spec
	p.Description = "Test data does not require any explicit configuration"
	p.Required = []string{"title"}
	p.AdditionalProperties = &spec.SchemaOrBool{Allows: false}
	p.Properties = map[string]spec.Schema{
		"title": *spec.StringProperty().
			WithDescription("display name"),
		"url": *spec.StringProperty().
			WithDescription("not used").
			WithExample("http://xxxx"),
	}

	return v
}

func SettingsExamples() *pluginschema.SettingsExamples {
	return &pluginschema.SettingsExamples{
		Examples: map[string]*spec3.Example{
			"": { // empty is the default one displayed in swagger
				ExampleProps: spec3.ExampleProps{
					Summary: "Empty testdata",
					Value: map[string]any{
						"kind": "DataSource",
						"metadata": map[string]any{
							"name": "my-testdata-datasource",
						},
						"spec": map[string]any{
							"title": "My TestData Datasource",
						},
					},
				},
			},
			"with-url": {
				ExampleProps: spec3.ExampleProps{
					Summary: "Testdata with URL (not used)",
					Value: map[string]any{
						"kind": "DataSource",
						"metadata": map[string]any{
							"name": "testdata-with-url",
						},
						"spec": map[string]any{
							"title": "TestData with URL",
							"url":   "http://example.com",
						},
					},
				},
			},
		},
	}
}

func Routes() *pluginschema.Routes {
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

	routes := &pluginschema.Routes{}
	routes.Register("/resources", spec3.PathProps{
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
		}})

	routes.Register("/resources/scenarios", spec3.PathProps{
		Summary: "hello world",
		Get: &spec3.Operation{
			OperationProps: spec3.OperationProps{
				Responses: unstructuredResponse,
			},
		},
	})

	routes.Register("/resources/stream", spec3.PathProps{
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
	})

	routes.Register("/resources/boom", spec3.PathProps{
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
	})

	routes.Register("/resources/test", spec3.PathProps{
		Summary: "Echo any request",
		Post: &spec3.Operation{
			OperationProps: spec3.OperationProps{
				RequestBody: unstructuredRequest,
				Responses:   unstructuredResponse,
			},
		},
	})

	routes.Register("/resources/test/json", spec3.PathProps{
		Summary: "Echo json request",
		Post: &spec3.Operation{
			OperationProps: spec3.OperationProps{
				RequestBody: unstructuredRequest,
				Responses:   unstructuredResponse,
			},
		},
	})

	routes.Register("/resources/sims", spec3.PathProps{
		Description: "Get list of simulations",
		Get: &spec3.Operation{
			OperationProps: spec3.OperationProps{
				Responses: unstructuredResponse,
			},
		},
	})

	routes.Register("/resources/sim/{key}", spec3.PathProps{
		Description: "Get list of simulations",
		Get: &spec3.Operation{
			OperationProps: spec3.OperationProps{
				Responses: unstructuredResponse,
			},
		},
		Post: &spec3.Operation{
			OperationProps: spec3.OperationProps{
				RequestBody: unstructuredRequest,
				Responses:   unstructuredResponse,
			},
		},
		Parameters: []*spec3.Parameter{
			{
				ParameterProps: spec3.ParameterProps{
					Name:        "key",
					In:          "path",
					Description: "simulation key (should include hz)",
					Required:    true,
					Examples: map[string]*spec3.Example{
						"1hz": {
							ExampleProps: spec3.ExampleProps{
								Value: "1hz",
							},
						},
						"10hz": {
							ExampleProps: spec3.ExampleProps{
								Value: "10hz",
							},
						},
					},
				},
			},
		},
	})
	return routes
}
