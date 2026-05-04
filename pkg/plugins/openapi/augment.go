package openapi

import (
	"fmt"
	"maps"
	"net/http"
	"slices"
	"strings"

	"golang.org/x/text/cases"
	"golang.org/x/text/language"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

const app_INSTANCE_NAME = "instance"

type PluginOptions struct {
	Schema *pluginschema.PluginSchema

	// The full resource config (spec and secure are children)
	Resource *spec.Schema

	// The name where the resource spec should be registered
	// eg: DataSourceSpec | AppPluginSpec
	SpecName string

	// root+"namespaces/{namespace}/datasources"
	// This is used for the POST examples
	Path string

	// When the value is an app, we expect {namespace}/app/instance
	IsApp bool
}

// nolint:gocyclo
func AugmentOpenAPI(oas *spec3.OpenAPI, opts PluginOptions) (*spec3.OpenAPI, error) {
	if opts.Schema.IsZero() {
		return oas, nil // nothing special
	}

	// Find the root path
	cfg := oas.Paths.Paths[opts.Path]
	if cfg == nil {
		return nil, fmt.Errorf("no route registered: %s", opts.Path)
	}
	if cfg.Post == nil {
		return nil, fmt.Errorf("expecting POST under: %s", opts.Path)
	}

	// Replace the generic DataSourceSpec with the explicit one
	settings := opts.Schema.SettingsSchema
	if !settings.IsZero() {
		resourceSpec := settings.Spec
		if opts.IsApp {
			resourceSpec = &spec.Schema{
				SchemaProps: spec.SchemaProps{
					Type: []string{"object"},
					Properties: map[string]spec.Schema{
						"pinned":   *spec.BooleanProperty().WithDescription("shows up in the sidebar"),
						"enabled":  *spec.BooleanProperty().WithDescription("can be executed"),
						"jsonData": *settings.Spec,
					},
				},
			}

			example := map[string]any{
				"meta": map[string]any{
					"name": app_INSTANCE_NAME,
				},
				"spec": map[string]any{
					"enabled": true,
					"pinned":  true,
					// JSONData (from examples)
				},
			}
			opts.Resource.Example = example
		}

		oas.Components.Schemas[opts.SpecName] = resourceSpec
		opts.Resource.Properties["spec"] = spec.Schema{
			SchemaProps: spec.SchemaProps{
				Ref: spec.MustCreateRef("#/components/schemas/" + opts.SpecName),
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
			opts.Resource.Properties["secure"] = spec.Schema{
				SchemaProps: spec.SchemaProps{
					Ref: spec.MustCreateRef("#/components/schemas/SecureValues"),
				},
			}
		}

		examples := opts.Schema.SettingsExamples
		if !examples.IsZero() {
			for _, c := range cfg.Post.RequestBody.Content {
				c.Examples = examples.Examples
			}
		}
	}

	routes := opts.Schema.Routes
	if routes.IsZero() {
		routes = &pluginschema.Routes{}
	}

	// Add custom schemas
	if routes.Components != nil {
		copyComponents(routes.Components, oas.Components)
	}

	if err := routes.AssertPrefixes("/resources", "/proxy"); err != nil {
		return oas, err
	}

	routePrefix := opts.Path + "/{name}"
	cfg = oas.Paths.Paths[routePrefix]
	if cfg == nil {
		return nil, fmt.Errorf("expecting route registered: %s", routePrefix)
	}
	if cfg.Get == nil {
		return nil, fmt.Errorf("expecting GET under: %s/{name}", routePrefix)
	}

	var params []*spec3.Parameter
	for _, p := range cfg.Parameters {
		if p.Name == "namespace" {
			params = append(params, p)
		}
		if p.Name == "name" && !opts.IsApp {
			params = append(params, p)
		}
	}

	if opts.IsApp {
		// Hide the non-instance based routes
		delete(oas.Paths.Paths, opts.Path)

		removeName := func(pp []*spec3.Parameter) (ret []*spec3.Parameter) {
			for _, p := range pp {
				if p.Name != "name" {
					ret = append(ret, p)
				}
			}
			return
		}

		// Replace the {name} property with /instance path
		appRoutePrefix := opts.Path + "/" + app_INSTANCE_NAME
		for k, v := range oas.Paths.Paths {
			if strings.HasPrefix(k, routePrefix) {
				delete(oas.Paths.Paths, k)
				k = strings.Replace(k, routePrefix, appRoutePrefix, 1)
				v.Parameters = removeName(v.Parameters)
				oas.Paths.Paths[k] = v
			}
		}
		routePrefix = appRoutePrefix
	}

	// When a schema is configured, remove the default mappings
	if len(routes.Paths) > 0 {
		delete(oas.Paths.Paths, routePrefix+"/resources")
		delete(oas.Paths.Paths, routePrefix+"/proxy")
	}

	// Add all the paths
	caser := cases.Title(language.English)
	for k, v := range routes.Paths {
		tag := caser.String(k[1:]) // "Resources", "Proxy"
		if idx := strings.Index(tag, "/"); idx > 0 {
			tag = tag[:idx]
		}
		v.Parameters = append(params, v.Parameters...)
		for m, op := range getPathOperations(&v.PathProps) {
			if op.Extensions == nil {
				op.Extensions = make(spec.Extensions)
			}
			if !slices.Contains(op.Tags, tag) {
				op.Tags = append(op.Tags, tag)
			}
			tmp := strings.ReplaceAll(strings.ReplaceAll(k, "{", ""), "}", "")
			op.OperationId = fmt.Sprintf("%s%s", strings.ToLower(m), strings.ReplaceAll(tmp, "/", "_"))
		}

		oas.Paths.Paths[routePrefix+k] = v
	}
	return oas, nil
}

// safely copy components from src to dst
func copyComponents(src *spec3.Components, dst *spec3.Components) {
	if src.Schemas != nil {
		if dst.Schemas == nil {
			dst.Schemas = make(map[string]*spec.Schema)
		}
		maps.Copy(dst.Schemas, src.Schemas)
	}

	if src.Responses != nil {
		if dst.Responses == nil {
			dst.Responses = make(map[string]*spec3.Response)
		}
		maps.Copy(dst.Responses, src.Responses)
	}

	if src.Examples != nil {
		if dst.Examples == nil {
			dst.Examples = make(map[string]*spec3.Example)
		}
		maps.Copy(dst.Examples, src.Examples)
	}

	if src.Headers != nil {
		if dst.Headers == nil {
			dst.Headers = make(map[string]*spec3.Header)
		}
		maps.Copy(dst.Headers, src.Headers)
	}

	if src.Parameters != nil {
		if dst.Parameters == nil {
			dst.Parameters = make(map[string]*spec3.Parameter)
		}
		maps.Copy(dst.Parameters, src.Parameters)
	}

	if src.Links != nil {
		if dst.Links == nil {
			dst.Links = make(map[string]*spec3.Link)
		}
		maps.Copy(dst.Links, src.Links)
	}

	if src.RequestBodies != nil {
		if dst.RequestBodies == nil {
			dst.RequestBodies = make(map[string]*spec3.RequestBody)
		}
		maps.Copy(dst.RequestBodies, src.RequestBodies)
	}
}

func getPathOperations(path *spec3.PathProps) map[string]*spec3.Operation {
	ops := make(map[string]*spec3.Operation)
	if path.Get != nil {
		ops[http.MethodGet] = path.Get
	}
	if path.Head != nil {
		ops[http.MethodHead] = path.Head
	}
	if path.Delete != nil {
		ops[http.MethodDelete] = path.Delete
	}
	if path.Post != nil {
		ops[http.MethodPost] = path.Post
	}
	if path.Put != nil {
		ops[http.MethodPut] = path.Put
	}
	if path.Patch != nil {
		ops[http.MethodPatch] = path.Patch
	}
	if path.Trace != nil {
		ops[http.MethodTrace] = path.Trace
	}
	if path.Options != nil {
		ops[http.MethodOptions] = path.Options
	}
	return ops
}
