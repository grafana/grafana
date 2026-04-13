package datasource

import (
	"fmt"
	"maps"
	"slices"
	"strings"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginspec"
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

	if b.pluginJSON.ID == "grafana-testdata-datasource" {
		fmt.Printf("XXXX")
	}

	custom, err := b.schemaProvider.GetOpenAPI(b.GetGroupVersion().Version)
	if err != nil {
		return nil, err
	}
	return transformOpenAPI(PluginSpecTransformOptions{
		oas:           oas,
		cfg:           ds,
		cfgSpecName:   "DataSourceSpec",
		cfgPath:       root + "namespaces/{namespace}/datasources",
		resourcesPath: root + "namespaces/{namespace}/datasources/{name}/resources",
		proxyPath:     root + "namespaces/{namespace}/datasources/{name}/proxy",
		ext:           custom,
	})
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
	resourcesPath string

	// Path where routes should be applied
	proxyPath string

	// Extensions
	ext *pluginspec.OpenAPIExtension
}

func transformOpenAPI(p PluginSpecTransformOptions) (*spec3.OpenAPI, error) {
	if p.ext == nil {
		return p.oas, nil // nothing special
	}
	oas := p.oas

	// Add custom schemas
	maps.Copy(p.oas.Components.Schemas, p.ext.Schemas)

	// Replace the generic DataSourceSpec with the explicit one
	if p.ext.Settings.Spec != nil {
		oas.Components.Schemas[p.cfgSpecName] = p.ext.Settings.Spec
		p.cfg.Properties["spec"] = spec.Schema{
			SchemaProps: spec.SchemaProps{
				Ref: spec.MustCreateRef("#/components/schemas/" + p.cfgSpecName),
			},
		}

		if len(p.ext.Settings.SecureValues) > 0 {
			example := common.InlineSecureValues{}
			ref := spec.MustCreateRef("#/components/schemas/com.github.grafana.grafana.pkg.apimachinery.apis.common.v0alpha1.InlineSecureValue")
			secure := &spec.Schema{
				SchemaProps: spec.SchemaProps{
					Properties:           make(map[string]spec.Schema),
					AdditionalProperties: &spec.SchemaOrBool{Allows: false},
				}}

			for _, v := range p.ext.Settings.SecureValues {
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

		// Add examples to the POST request
		if len(p.ext.Settings.Examples) > 0 {
			cfg := oas.Paths.Paths[p.cfgPath]
			if cfg == nil {
				return nil, fmt.Errorf("no route registered: %s", p.cfgPath)
			}
			if cfg.Post == nil {
				return nil, fmt.Errorf("expecting under: %s", p.cfgPath)
			}
			for _, c := range cfg.Post.RequestBody.Content {
				c.Examples = p.ext.Settings.Examples
			}
		}
	}

	if p.ext.Routes != nil {
		if len(p.ext.Routes.Resource) > 0 {
			if err := p.applyRoutes(p.resourcesPath, p.ext.Routes.Resource); err != nil {
				return nil, err
			}
		}
		if len(p.ext.Routes.Proxy) > 0 {
			if err := p.applyRoutes(p.proxyPath, p.ext.Routes.Proxy); err != nil {
				return nil, err
			}
		}
	}
	return oas, nil
}

func (p *PluginSpecTransformOptions) applyRoutes(prefix string, routes map[string]*spec3.Path) error {
	var params []*spec3.Parameter

	cfg := p.oas.Paths.Paths[p.cfgPath+"/{name}"]
	if cfg == nil {
		return fmt.Errorf("expecting registered path for: %s", p.cfgPath+"/{name}")
	}
	if strings.Contains(prefix, "{namespace}") {
		for _, p := range cfg.Parameters {
			if p.Name == "namespace" {
				params = append(params, p)
			}
		}
	}
	if strings.Contains(prefix, "{name}") {
		for _, p := range cfg.Parameters {
			if p.Name == "name" {
				params = append(params, p)
			}
		}
	}

	// Remove all the paths that were not specified
	for k := range p.oas.Paths.Paths {
		if strings.HasPrefix(k, prefix) {
			delete(p.oas.Paths.Paths, k)
		}
	}

	for k, v := range routes {
		if k != "" && !strings.HasPrefix(k, "/") {
			return fmt.Errorf("path must have slash prefix")
		}
		v.Parameters = append(v.Parameters, params...)
		for m, op := range builder.GetPathOperations(&v.PathProps) {
			if op.Extensions == nil {
				op.Extensions = make(spec.Extensions)
			}
			if !slices.Contains(op.Tags, "Route") {
				op.Tags = append(op.Tags, "Route") // Custom resource?
			}
			tmp := strings.ReplaceAll(strings.ReplaceAll(k, "{", ""), "}", "")
			op.OperationId = fmt.Sprintf("%s_route%s", strings.ToLower(m), strings.ReplaceAll(tmp, "/", "_"))
		}
		p.oas.Paths.Paths[prefix+k] = v
	}
	return nil
}
