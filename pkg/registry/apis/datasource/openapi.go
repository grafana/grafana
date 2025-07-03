package datasource

import (
	"fmt"
	"maps"
	"strings"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	secretsV0 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/query/queryschema"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
)

func (b *DataSourceAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = b.pluginJSON.Info.Description

	// The root api URL
	root := "/apis/" + b.datasourceResourceInfo.GroupVersion().String() + "/"

	// Add queries to the request properties
	if err := queryschema.AddQueriesToOpenAPI(queryschema.OASQueryOptions{
		Swagger:          oas,
		PluginJSON:       &b.pluginJSON,
		QueryTypes:       b.queryTypes,
		Root:             root,
		QueryPath:        "namespaces/{namespace}/datasources/{name}/query",
		QueryDescription: fmt.Sprintf("Query the %s datasources", b.pluginJSON.Name),
	}); err != nil {
		return nil, err
	}

	// Set explicit apiVersion and kind on the datasource
	ds, ok := oas.Components.Schemas["com.github.grafana.grafana.pkg.apis.datasource.v0alpha1.DataSource"]
	if !ok {
		return nil, fmt.Errorf("missing DS type")
	}
	ds.Properties["apiVersion"] = *spec.StringProperty().WithEnum(b.GetGroupVersion().String())
	ds.Properties["kind"] = *spec.StringProperty().WithEnum("DataSource")

	custom, err := getCustomOpenAPI(b.pluginJSON.ID)
	if err != nil {
		return nil, err
	}
	if custom == nil {
		return oas, nil // nothing special
	}

	// Add custom schemas
	maps.Copy(oas.Components.Schemas, custom.Schemas)

	// Replace the generic DataSourceSpec with the explicit one
	if custom.DataSourceSpec != nil {
		oas.Components.Schemas["DataSourceSpec"] = custom.DataSourceSpec
		ds.Properties["spec"] = spec.Schema{
			SchemaProps: spec.SchemaProps{
				Ref: spec.MustCreateRef("#/components/schemas/DataSourceSpec"),
			},
		}
	}

	if custom.SecureValues != nil {
		example := secretsV0.InlineSecureValues{}
		ref := spec.MustCreateRef("#/components/schemas/com.github.grafana.grafana.pkg.apis.secret.v0alpha1.InlineSecureValue")
		secure := &spec.Schema{
			SchemaProps: spec.SchemaProps{
				Properties:           make(map[string]spec.Schema),
				AdditionalProperties: &spec.SchemaOrBool{Allows: false},
			}}
		secure.Description = "custom secure value definition"

		for _, v := range custom.SecureValues {
			secure.Properties[v.Key] = spec.Schema{
				SchemaProps: spec.SchemaProps{
					Description: v.Description,
					Ref:         ref,
				},
			}
			if v.Required {
				secure.Required = append(secure.Required, v.Key)
				example[v.Key] = secretsV0.InlineSecureValue{Create: "***"}
			}
		}

		if len(example) > 0 {
			secure.Example = example
		}

		// Link the explicit secure values in the resource
		oas.Components.Schemas["SecureValues"] = secure
		ds.Properties["secure"] = spec.Schema{
			SchemaProps: spec.SchemaProps{
				Ref: spec.MustCreateRef("#/components/schemas/SecureValues"),
			},
		}
	}

	if len(custom.Routes) > 0 {
		ds := oas.Paths.Paths[root+"namespaces/{namespace}/datasources/{name}"]
		if ds == nil || len(ds.Parameters) < 2 {
			return nil, fmt.Errorf("missing parmeters")
		}

		prefix := root + "namespaces/{namespace}/datasources/{name}/resource"
		for k := range oas.Paths.Paths {
			if strings.HasPrefix(k, prefix) {
				delete(oas.Paths.Paths, k)
			}
		}

		for k, v := range custom.Routes {
			if k != "" && !strings.HasPrefix(k, "/") {
				return nil, fmt.Errorf("path must have slash prefix")
			}
			v.Parameters = append(v.Parameters, ds.Parameters[0:2]...)
			for _, op := range builder.GetPathOperations(v) {
				if op != nil {
					op.Tags = append(op.Tags, "Route") // Custom resource?
				}
			}
			oas.Paths.Paths[prefix+k] = v // TODO add namepsace + name parameters
		}
	}
	return oas, err
}

func getCustomOpenAPI(plugin string) (*datasourceV0.DataSourceOpenAPIExtension, error) {
	if plugin == "grafana-testdata-datasource" {
		oas := &datasourceV0.DataSourceOpenAPIExtension{
			SecureValues: []datasourceV0.SecureValueInfo{{
				Key:         "aaa",
				Description: "describe aaa",
				Required:    true,
			}, {
				Key:         "bbb",
				Description: "describe bbb",
			}},
		}

		// Dummy spec
		p := &spec.Schema{} //SchemaProps: spec.SchemaProps{Type: []string{"object"}}}
		p.Description = "HELLO!"
		p.Required = []string{"url"}
		p.AdditionalProperties = &spec.SchemaOrBool{Allows: false}
		p.Properties = map[string]spec.Schema{
			"url":   *spec.StringProperty(),
			"str":   *spec.StringProperty(), // ??? must this be under jsonData?
			"int64": *spec.Int64Property(),  // ??? must this be under jsonData?
		}
		p.Example = map[string]any{
			"url":   "http://xxxx",
			"int64": 1234,
		}
		oas.DataSourceSpec = p

		// Resource routes
		// https://github.com/grafana/grafana/blob/main/pkg/tsdb/grafana-testdata-datasource/resource_handler.go#L20
		unstructured := spec.RefProperty("#/components/schemas/com.github.grafana.grafana.pkg.apimachinery.apis.common.v0alpha1.Unstructured")
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
					"applicaiton/json": {
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

		// mux.HandleFunc("/sims", s.sims.GetSimulationHandler)
		// mux.HandleFunc("/sim/", s.sims.GetSimulationHandler)

		// Duplicate the test route (but with a new path)
		testcopy := *oas.Routes["/test"]
		oas.Routes["/test/json"] = &testcopy

		return oas, nil
	}
	return nil, nil
}
