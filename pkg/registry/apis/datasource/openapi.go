package datasource

import (
	"fmt"
	"maps"
	"strings"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
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

	if b.schemaProvider == nil {
		return oas, nil
	}

	custom, err := b.schemaProvider()
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
		example := common.InlineSecureValues{}
		ref := spec.MustCreateRef("#/components/schemas/com.github.grafana.grafana.pkg.apimachinery.apis.common.v0alpha1.InlineSecureValue")
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
				example[v.Key] = common.InlineSecureValue{Create: "***"}
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
			return nil, fmt.Errorf("missing Parameters")
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
			oas.Paths.Paths[prefix+k] = v // TODO add namespace + name parameters
		}
	}
	return oas, err
}
