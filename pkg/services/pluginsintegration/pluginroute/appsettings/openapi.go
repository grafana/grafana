package appsettings

import (
	"fmt"
	"net/http"
	"slices"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	kcommon "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/definition"
)

func (b *Builder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return apppluginV0.GetOpenAPIDefinitions
}

func (b *Builder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	version := apppluginV0.VERSION
	var schema *pluginschema.PluginSchema
	if b.schemas != nil {
		schema = b.schemas[version]
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
	root := fmt.Sprintf("/apis/%s/%s/", b.group, version)

	// The subresources are plain handlers, so the API server documents none of
	// them. The settings manifest's resource and proxy routes are published
	// here; the schema's routes, if it defines any, are added after them.
	if err := b.addSubresourcePaths(oas, root+"namespaces/{namespace}/app/{name}", version); err != nil {
		return nil, err
	}

	// Set explicit apiVersion and kind on the datasource
	ps, ok := oas.Components.Schemas[apppluginV0.Settings{}.OpenAPIModelName()]
	if !ok {
		return nil, fmt.Errorf("missing settings type")
	}
	ps.Properties["apiVersion"] = *spec.StringProperty().WithEnum(fmt.Sprintf("%s/%s", b.group, version))
	ps.Properties["kind"] = *spec.StringProperty().WithEnum("Settings")

	// Always transform results
	switch {
	case schema.IsZero():
		schema = defaultSchema()
	case schema.SettingsSchema.IsZero():
		schema.SettingsSchema = defaultSchema().SettingsSchema
	}

	return definition.AugmentOpenAPI(oas, definition.SettingsResource{
		Schema:   schema,
		Resource: ps,
		SpecName: "SettingsSpec",
		Path:     root + "namespaces/{namespace}/app",
		IsApp:    true,
	})
}

func (b *Builder) addSubresourcePaths(oas *spec3.OpenAPI, item, version string) error {
	settings := oas.Paths.Paths[item]
	if settings == nil {
		return fmt.Errorf("expecting route registered: %s", item)
	}
	var params []*spec3.Parameter
	for _, p := range settings.Parameters {
		if p.Name == "namespace" || p.Name == "name" {
			params = append(params, p)
		}
	}
	operation := func(id, description string, kind string, schema *spec.Schema) *spec3.Path {
		op := &spec3.Operation{OperationProps: spec3.OperationProps{
			Tags:        []string{"Settings"},
			Description: description,
			OperationId: id,
			Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{
				StatusCodeResponses: map[int]*spec3.Response{
					http.StatusOK: {ResponseProps: spec3.ResponseProps{
						Description: "OK",
						Content:     map[string]*spec3.MediaType{"*/*": {MediaTypeProps: spec3.MediaTypeProps{Schema: schema}}},
					}},
				},
			}},
		}}
		op.AddExtension("x-kubernetes-action", "connect")
		op.AddExtension("x-kubernetes-group-version-kind", map[string]string{"group": b.group, "kind": kind, "version": version})
		return &spec3.Path{PathProps: spec3.PathProps{Get: op, Parameters: slices.Clone(params)}}
	}

	health := apppluginV0.HealthCheckResult{}.OpenAPIModelName()
	if _, ok := oas.Components.Schemas[health]; !ok {
		defs := apppluginV0.GetOpenAPIDefinitions(func(name string) spec.Ref {
			return spec.MustCreateRef("#/components/schemas/" + name)
		})
		s := defs[health].Schema
		// Match what the API server emits for a kind it serves: OpenAPI 3.0
		// ignores the siblings of a $ref, so a described reference is wrapped.
		for name, prop := range s.Properties {
			if prop.Ref.String() != "" && prop.Description != "" {
				prop.AllOf = []spec.Schema{{SchemaProps: spec.SchemaProps{Ref: prop.Ref}}}
				prop.Ref = spec.Ref{}
				s.Properties[name] = prop
			}
		}
		s.AddExtension("x-kubernetes-group-version-kind", []map[string]string{{"group": b.group, "kind": "HealthCheckResult", "version": version}})
		oas.Components.Schemas[health] = &s
	}
	oas.Paths.Paths[item+"/health"] = operation("getSettingsHealth", "connect GET requests to health of Settings",
		"HealthCheckResult", spec.RefSchema("#/components/schemas/"+health))

	routes := b.settingsRoutes()
	if len(routes.resources) == 0 {
		oas.Paths.Paths[item+"/resources"] = operation("getSettingsResources",
			"Get resources in the resources plugin. NOTE, additional routes may exist, but are not exposed via OpenAPI",
			"Status", spec.StringProperty())
	}
	publish := func(subresource string, paths map[string]spec3.PathProps) {
		for specPath, props := range paths {
			props.Parameters = append(slices.Clone(params), props.Parameters...)
			props.Parameters = append(props.Parameters, undeclaredPathParameters(specPath, &props)...)
			for _, op := range []**spec3.Operation{&props.Get, &props.Head, &props.Post, &props.Put, &props.Patch, &props.Delete, &props.Options} {
				if *op != nil {
					tagged := **op
					tagged.Tags = []string{"Settings"}
					*op = &tagged
				}
			}
			oas.Paths.Paths[strings.TrimSuffix(item+"/"+subresource+"/"+specPath, "/")] = &spec3.Path{PathProps: props}
		}
	}
	publish("resources", routes.resources)
	if b.registersProxy() {
		publish("proxy", b.proxyRoutes().paths)
	}
	b.addComponents(oas, routes.components)
	return nil
}

// addComponents publishes the components the settings manifest's routes refer
// to. One named as a generated component, such as the settings kind, is left
// out: the API server describes what it serves.
func (b *Builder) addComponents(oas *spec3.OpenAPI, components app.ManifestVersionOpenAPIComponents) {
	if len(components.Schemas)+len(components.Responses)+len(components.Examples) == 0 {
		return
	}
	if oas.Components == nil {
		oas.Components = &spec3.Components{}
	}
	skipped := func(kind, name string) {
		logger.Warn("settings manifest component is not published: the name is taken", "plugin", b.group, "component", kind, "name", name)
	}
	for name, s := range components.Schemas {
		if _, ok := oas.Components.Schemas[name]; ok {
			skipped("schema", name)
			continue
		}
		if oas.Components.Schemas == nil {
			oas.Components.Schemas = map[string]*spec.Schema{}
		}
		oas.Components.Schemas[name] = &s
	}
	addMissing(&oas.Components.Responses, components.Responses, func(name string) { skipped("response", name) })
	addMissing(&oas.Components.Examples, components.Examples, func(name string) { skipped("example", name) })
}

func addMissing[T any](dst *map[string]T, src map[string]T, taken func(string)) {
	for name, v := range src {
		if _, ok := (*dst)[name]; ok {
			taken(name)
			continue
		}
		if *dst == nil {
			*dst = map[string]T{}
		}
		(*dst)[name] = v
	}
}

// undeclaredPathParameters documents the parameters of a route's path that
// neither the path nor its operations declare, as strings.
func undeclaredPathParameters(path string, props *spec3.PathProps) []*spec3.Parameter {
	declared := map[string]bool{}
	for _, p := range props.Parameters {
		declared[p.Name] = true
	}
	ops := []*spec3.Operation{props.Get, props.Head, props.Post, props.Put, props.Patch, props.Delete, props.Options}
	var missing []*spec3.Parameter
	for _, segment := range strings.Split(path, "/") {
		if !strings.HasPrefix(segment, "{") || !strings.HasSuffix(segment, "}") {
			continue
		}
		name := segment[1 : len(segment)-1]
		if declared[name] {
			continue
		}
		inOps := false
		for _, op := range ops {
			if op != nil && slices.ContainsFunc(op.Parameters, func(p *spec3.Parameter) bool { return p.Name == name && p.In == "path" }) {
				inOps = true
			}
		}
		if !inOps {
			declared[name] = true
			missing = append(missing, &spec3.Parameter{ParameterProps: spec3.ParameterProps{
				Name: name, In: "path", Required: true, Schema: spec.StringProperty(),
			}})
		}
	}
	return missing
}

func defaultSchema() *pluginschema.PluginSchema {
	return &pluginschema.PluginSchema{
		SettingsSchema: &pluginschema.Settings{
			Spec: &spec.Schema{
				SchemaProps: spec.SchemaProps{ // The jsonSchema object
					Type:                 []string{"object"},
					AdditionalProperties: &spec.SchemaOrBool{Allows: true},
				},
			},
		},
		SettingsExamples: &pluginschema.SettingsExamples{
			Examples: map[string]*spec3.Example{
				"empty": {
					ExampleProps: spec3.ExampleProps{
						Summary: "example",
						Value: apppluginV0.Settings{
							ObjectMeta: v1.ObjectMeta{
								Name: apppluginV0.INSTANCE_NAME,
							},
							Spec: apppluginV0.SettingsSpec{
								Enabled:  true,
								Pinned:   true,
								JsonData: kcommon.Unstructured{},
							},
						},
					},
				},
			},
		},
	}
}
