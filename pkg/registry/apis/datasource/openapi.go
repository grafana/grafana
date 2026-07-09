package datasource

import (
	"fmt"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/openapi"
	"github.com/grafana/grafana/pkg/registry/apis/query/queryschema"
)

func (b *DataSourceAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	var queryExamples *data.QueryExamples
	var schema *pluginschema.PluginSchema
	if b.schemas != nil {
		schema = b.schemas[b.GetGroupVersion().Version]
		if schema != nil {
			queryExamples = schema.QueryExamples
		}
	}

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
		Swagger:             oas,
		PluginJSON:          &b.pluginJSON,
		QueryTypes:          b.queryTypes,
		QueryExamplesConfig: queryExamples,
		Root:                root,
		QueryPath:           "namespaces/{namespace}/datasources/{name}/query",
		QueryDescription:    fmt.Sprintf("Query the %s datasources", b.pluginJSON.Name),
	}); err != nil {
		return nil, err
	}

	// Set the operation ID for the query path
	query := oas.Paths.Paths[root+"namespaces/{namespace}/datasources/{name}/query"]
	if query == nil || query.Post == nil {
		return nil, fmt.Errorf("missing datasources query path")
	}
	query.Post.OperationId = "queryDataSource"
	for _, p := range query.Parameters {
		if p.Name == "name" {
			p.Description = "DataSource identifier"
		}
	}

	content := map[string]*spec3.MediaType{
		"application/json": {
			MediaTypeProps: spec3.MediaTypeProps{
				Schema: &spec.Schema{
					SchemaProps: spec.SchemaProps{
						Ref: spec.MustCreateRef("#/components/schemas/" + datasourceV0.QueryDataResponse{}.OpenAPIModelName()),
					},
				},
			},
		},
	}

	if b.cfg.EnableChunkedQueryStreaming {
		content["text/jsonl"] = &spec3.MediaType{
			MediaTypeProps: spec3.MediaTypeProps{
				Schema: &spec.Schema{
					SchemaProps: spec.SchemaProps{
						Description: "Each line is a valid JSON event",
						Type:        []string{"string"},
						Format:      "",
					},
				},
			},
		}
	}

	// Add explicit response format
	query.Post.Responses = &spec3.Responses{
		ResponsesProps: spec3.ResponsesProps{
			StatusCodeResponses: map[int]*spec3.Response{
				200: {
					ResponseProps: spec3.ResponseProps{
						Description: "OK",
						Content:     content,
					},
				},
			},
		},
	}

	// Hide the resource+proxy routes -- explicit ones will be added if defined below
	for _, v := range []string{"resources", "proxy"} {
		prefix := root + "namespaces/{namespace}/datasources/{name}/" + v
		r := oas.Paths.Paths[prefix]
		if r != nil && r.Get != nil {
			r.Get.Description = "Get resources in the " + v + " plugin. NOTE, additional routes may exist, but are not exposed via OpenAPI"
			r.Delete = nil
			r.Head = nil
			r.Patch = nil
			r.Post = nil
			r.Put = nil
			r.Options = nil
		}
		delete(oas.Paths.Paths, prefix+"/{path}")
	}

	// Set explicit apiVersion and kind on the datasource
	ds, ok := oas.Components.Schemas[datasourceV0.DataSource{}.OpenAPIModelName()]
	if !ok {
		return nil, fmt.Errorf("missing DS type")
	}
	ds.Properties["apiVersion"] = *spec.StringProperty().WithEnum(b.GetGroupVersion().String())
	ds.Properties["kind"] = *spec.StringProperty().WithEnum("DataSource")

	if !b.cfg.LoadOpenAPISpec || schema == nil {
		return oas, nil
	}

	return openapi.AugmentOpenAPI(oas, openapi.PluginOptions{
		Schema:   schema,
		Resource: ds,
		SpecName: "DataSourceSpec",
		Path:     root + "namespaces/{namespace}/datasources",
	})
}
