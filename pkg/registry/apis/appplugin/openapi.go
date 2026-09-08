package appplugin

import (
	"fmt"
	"strings"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	kcommon "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/definition"
)

func (b *AppPluginAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	return apppluginV0.GetOpenAPIDefinitions
}

func (b *AppPluginAPIBuilder) PostProcessOpenAPI(oas *spec3.OpenAPI) (*spec3.OpenAPI, error) {
	// This is called once per group version, but the target version is not
	// passed in -- recover it from the spec's Info.Title stamp.
	version := b.specVersion(oas)

	var schema *pluginschema.PluginSchema
	if b.schemas != nil {
		schema = b.schemas[version]
		if schema.IsZero() {
			schema = b.schemas[apppluginV0.VERSION] // v0 is always configured
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
	root := fmt.Sprintf("/apis/%s/%s/", b.pluginJSON.ID, version)

	// Hide the resource+proxy routes -- explicit ones will be added if defined below
	for _, v := range []string{"resources", "proxy"} {
		prefix := root + "namespaces/{namespace}/app/{name}/" + v
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
	ps, ok := oas.Components.Schemas[apppluginV0.Settings{}.OpenAPIModelName()]
	if !ok {
		return nil, fmt.Errorf("missing settings type")
	}
	ps.Properties["apiVersion"] = *spec.StringProperty().WithEnum(fmt.Sprintf("%s/%s", b.pluginJSON.ID, version))
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

// specVersion returns the version of the group-version spec being processed.
// The builder framework stamps every per-version spec with
// Info.Title = "<group>/<version>" before post-processing runs, and for app
// plugins the group is the plugin id.
func (b *AppPluginAPIBuilder) specVersion(oas *spec3.OpenAPI) string {
	if oas.Info != nil {
		if version, ok := strings.CutPrefix(oas.Info.Title, b.pluginJSON.ID+"/"); ok && version != "" {
			return version
		}
	}
	return apppluginV0.VERSION
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
