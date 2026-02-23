package datasource

import (
	"fmt"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana/pkg/registry/apis/query/queryschema"
)

func (b *DataSourceAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = b.pluginJSON.Info.Description

	// Add plugin information
	info := map[string]any{
		"id": b.pluginJSON.ID,
	}
	if b.pluginJSON.Info.Version != "" {
		info["version"] = b.pluginJSON.Info.Version
	}
	if b.pluginJSON.Info.Build.Time > 0 {
		info["build"] = b.pluginJSON.Info.Build.Time
	}
	oas.Info.AddExtension("x-grafana-plugin", info)

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

	// Hide the resource routes -- explicit ones will be added if defined below
	prefix := root + "namespaces/{namespace}/datasources/{name}/resource"
	r := oas.Paths.Paths[prefix]
	if r != nil && r.Get != nil {
		r.Get.Description = "Get resources in the datasource plugin. NOTE, additional routes may exist, but are not exposed via OpenAPI"
		r.Delete = nil
		r.Head = nil
		r.Patch = nil
		r.Post = nil
		r.Put = nil
		r.Options = nil
	}
	delete(oas.Paths.Paths, prefix+"/{path}")

	// Set explicit apiVersion and kind on the datasource
	ds, ok := oas.Components.Schemas["com.github.grafana.grafana.pkg.apis.datasource.v0alpha1.DataSource"]
	if !ok {
		return nil, fmt.Errorf("missing DS type")
	}
	ds.Properties["apiVersion"] = *spec.StringProperty().WithEnum(b.GetGroupVersion().String())
	ds.Properties["kind"] = *spec.StringProperty().WithEnum("DataSource")

	// Mark connections as deprecated
	delete(oas.Paths.Paths, root+"namespaces/{namespace}/connections/{name}")
	query := oas.Paths.Paths[root+"namespaces/{namespace}/connections/{name}/query"]
	for query == nil || query.Post == nil {
		return nil, fmt.Errorf("missing temporary connection path")
	}
	query.Post.Tags = []string{"Connections (deprecated)"}
	query.Post.Deprecated = true
	query.Post.RequestBody = &spec3.RequestBody{
		RequestBodyProps: spec3.RequestBodyProps{
			Content: map[string]*spec3.MediaType{
				"application/json": {
					MediaTypeProps: spec3.MediaTypeProps{
						Schema: spec.MapProperty(nil),
					},
				},
			},
		},
	}

	// For testdata, add an explicit response format
	if b.pluginJSON.ID == "grafana-testdata-datasource" {
		query = oas.Paths.Paths[root+"namespaces/{namespace}/datasources/{name}/query"]
		for query == nil || query.Post == nil {
			return nil, fmt.Errorf("missing datasources query path")
		}
		query.Post.Responses = &spec3.Responses{
			ResponsesProps: spec3.ResponsesProps{
				StatusCodeResponses: map[int]*spec3.Response{
					200: {
						ResponseProps: spec3.ResponseProps{
							Description: "OK",
							Content: map[string]*spec3.MediaType{
								"application/json": {
									MediaTypeProps: spec3.MediaTypeProps{
										Schema: &spec.Schema{
											SchemaProps: spec.SchemaProps{
												Ref: spec.MustCreateRef("#/components/schemas/com.github.grafana.grafana.pkg.apis.query.v0alpha1.QueryDataResponse"),
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

	return oas, nil
}
