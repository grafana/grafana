package datasource

import (
	"fmt"
	"maps"
	"slices"
	"strings"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/query/queryschema"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
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
	// Add explicit response format
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
											Ref: spec.MustCreateRef("#/components/schemas/" + datasourceV0.QueryDataResponse{}.OpenAPIModelName()),
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
	ds, ok := oas.Components.Schemas[datasourceV0.DataSource{}.OpenAPIModelName()]
	if !ok {
		return nil, fmt.Errorf("missing DS type")
	}
	ds.Properties["apiVersion"] = *spec.StringProperty().WithEnum(b.GetGroupVersion().String())
	ds.Properties["kind"] = *spec.StringProperty().WithEnum("DataSource")

	if b.schemaProvider == nil || !b.cfg.LoadOpenAPISpec {
		return oas, nil
	}

	return transformOpenAPI(PluginSpecTransformOptions{
		oas:         oas,
		cfg:         ds,
		cfgSpecName: "DataSourceSpec",
		cfgPath:     root + "namespaces/{namespace}/datasources",
		routePrefix: root + "namespaces/{namespace}/datasources/{name}",
		schemas:     b.schemaProvider,
	}, b.GetGroupVersion().Version)
}

type PluginSpecTransformOptions struct {
	oas *spec3.OpenAPI

	// The full resource config (spec and secure are children)
	cfg *spec.Schema

	// root+"namespaces/{namespace}/datasources"
	// This is used for the POST examples
	cfgPath string

	// DataSourceSpec | AppPluginSpec
	cfgSpecName string

	// Path where routes should be applied
	routePrefix string

	// Extensions
	schemas pluginschema.SchemaProvider
}

func transformOpenAPI(p PluginSpecTransformOptions, apiVersion string) (*spec3.OpenAPI, error) {
	if p.schemas == nil {
		return p.oas, nil // nothing special
	}

	settings, err := p.schemas.GetSettings(apiVersion)
	if err != nil {
		return nil, err
	}

	oas := p.oas

	// Replace the generic DataSourceSpec with the explicit one
	if settings != nil && settings.Spec != nil {
		oas.Components.Schemas[p.cfgSpecName] = settings.Spec
		p.cfg.Properties["spec"] = spec.Schema{
			SchemaProps: spec.SchemaProps{
				Ref: spec.MustCreateRef("#/components/schemas/" + p.cfgSpecName),
			},
		}

		if len(settings.SecureValues) > 0 {
			example := common.InlineSecureValues{}
			ref := spec.MustCreateRef("#/components/schemas/com.github.grafana.grafana.pkg.apimachinery.apis.common.v0alpha1.InlineSecureValue")
			secure := &spec.Schema{
				SchemaProps: spec.SchemaProps{
					Properties:           make(map[string]spec.Schema),
					AdditionalProperties: &spec.SchemaOrBool{Allows: false},
				}}

			for _, v := range settings.SecureValues {
				secure.Properties[v.Key] = spec.Schema{
					SchemaProps: spec.SchemaProps{
						Description: v.Description,
						Ref:         ref,
					},
				}
				if v.Required {
					secure.Required = append(secure.Required, v.Key)
					example[v.Key] = common.InlineSecureValue{Create: "***"}
				}
			}

			if len(example) > 0 {
				secure.Example = example
			}

			// Link the explicit secure values in the resource
			oas.Components.Schemas["SecureValues"] = secure
			p.cfg.Properties["secure"] = spec.Schema{
				SchemaProps: spec.SchemaProps{
					Ref: spec.MustCreateRef("#/components/schemas/SecureValues"),
				},
			}
		}

		examples, err := p.schemas.GetSettingsExamples(apiVersion)
		if err != nil {
			return nil, err
		}

		// Add examples to the POST request
		if len(examples.Examples) > 0 {
			cfg := oas.Paths.Paths[p.cfgPath]
			if cfg == nil {
				return nil, fmt.Errorf("no route registered: %s", p.cfgPath)
			}
			if cfg.Post == nil {
				return nil, fmt.Errorf("expecting under: %s", p.cfgPath)
			}
			for _, c := range cfg.Post.RequestBody.Content {
				c.Examples = examples.Examples
			}
		}
	}

	routes, err := p.schemas.GetRoutes(apiVersion)
	if err != nil || routes == nil {
		return oas, err
	}

	// Add custom schemas
	if routes.Components != nil {
		maps.Copy(p.oas.Components.Schemas, routes.Components.Schemas)
		maps.Copy(p.oas.Components.Responses, routes.Components.Responses)
		maps.Copy(p.oas.Components.Examples, routes.Components.Examples)
		maps.Copy(p.oas.Components.Headers, routes.Components.Headers)
		maps.Copy(p.oas.Components.Parameters, routes.Components.Parameters)
		maps.Copy(p.oas.Components.Links, routes.Components.Links)
		maps.Copy(p.oas.Components.RequestBodies, routes.Components.RequestBodies)
	}

	if err = routes.AssertPrefixes("/resources", "/proxy"); err != nil {
		return oas, err
	}

	if len(routes.Paths) < 1 {
		return oas, nil
	}

	var params []*spec3.Parameter
	cfg := p.oas.Paths.Paths[p.routePrefix]
	if cfg == nil {
		return nil, fmt.Errorf("expecting registered path for: %s", p.routePrefix)
	}
	if strings.Contains(p.routePrefix, "{namespace}") {
		for _, p := range cfg.Parameters {
			if p.Name == "namespace" {
				params = append(params, p)
			}
		}
	}
	if strings.Contains(p.routePrefix, "{name}") {
		for _, p := range cfg.Parameters {
			if p.Name == "name" {
				params = append(params, p)
			}
		}
	}

	// Add all the paths
	caser := cases.Title(language.English)
	for k, v := range routes.Paths {
		tag := caser.String(k[1:]) // "Resources", "Proxy"
		if idx := strings.Index(tag, "/"); idx > 0 {
			tag = tag[:idx]
		}
		v.Parameters = params
		for m, op := range builder.GetPathOperations(&v.PathProps) {
			if op.Extensions == nil {
				op.Extensions = make(spec.Extensions)
			}
			if !slices.Contains(op.Tags, tag) {
				op.Tags = append(op.Tags, tag)
			}
			tmp := strings.ReplaceAll(strings.ReplaceAll(k, "{", ""), "}", "")
			op.OperationId = fmt.Sprintf("%s%s", strings.ToLower(m), strings.ReplaceAll(tmp, "/", "_"))
		}

		p.oas.Paths.Paths[p.routePrefix+k] = v
	}
	return oas, nil
}
