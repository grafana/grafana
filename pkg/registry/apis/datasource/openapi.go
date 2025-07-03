package datasource

import (
	"fmt"
	"maps"

	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	secretsV0 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/query/queryschema"
)

func (b *DataSourceAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// The plugin description
	oas.Info.Description = b.pluginJSON.Info.Description

	// The root api URL
	root := "/apis/" + b.datasourceResourceInfo.GroupVersion().String() + "/"

	// Add queries to the request properties
	err := queryschema.AddQueriesToOpenAPI(queryschema.OASQueryOptions{
		Swagger:          oas,
		PluginJSON:       &b.pluginJSON,
		QueryTypes:       b.queryTypes,
		Root:             root,
		QueryPath:        "namespaces/{namespace}/datasources/{name}/query",
		QueryDescription: fmt.Sprintf("Query the %s datasources", b.pluginJSON.Name),
	})

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

		return oas, nil
	}
	return nil, nil
}
