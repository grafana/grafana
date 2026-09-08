package appplugin

import (
	"encoding/json"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
)

func testVersionSchema(t *testing.T, raw string) *app.VersionSchema {
	t.Helper()

	var schema app.VersionSchema
	require.NoError(t, json.Unmarshal([]byte(raw), &schema))
	return &schema
}

func testManifest(t *testing.T) *app.ManifestData {
	t.Helper()

	operation := func(id string) *spec3.Operation {
		return &spec3.Operation{OperationProps: spec3.OperationProps{
			OperationId: id,
			Responses: &spec3.Responses{ResponsesProps: spec3.ResponsesProps{
				Default: &spec3.Response{ResponseProps: spec3.ResponseProps{Description: "OK"}},
			}},
		}}
	}

	return &app.ManifestData{
		AppName:          "example",
		AppDisplayName:   "Example",
		Group:            "example.ext.grafana.app",
		PreferredVersion: "v1alpha1",
		Versions: []app.ManifestVersion{
			{
				Name:   "v0alpha1",
				Served: true,
				Kinds: []app.ManifestVersionKind{{
					Kind:   "TestKind",
					Plural: "TestKinds",
					Scope:  "Namespaced",
					Schema: testVersionSchema(t, `{
						"TestKind":{"type":"object","properties":{"spec":{"$ref":"#/components/schemas/spec"}},"required":["spec"]},
						"spec":{"type":"object","additionalProperties":false,"properties":{"testField":{"type":"integer"}},"required":["testField"]}
					}`),
				}},
			},
			{
				Name:   "v1alpha1",
				Served: true,
				Kinds: []app.ManifestVersionKind{{
					Kind:   "TestKind",
					Plural: "TestKinds",
					Scope:  "Namespaced",
					// Declared search fields are what enrol a kind in the search
					// endpoints; the v0alpha1 kind above declares none.
					SearchFields: []app.ManifestVersionKindSearchField{{
						Name: "testField", Path: "spec.testField", Type: "string",
					}},
					Routes: map[string]spec3.PathProps{
						"/reload": {Post: operation("reloadTestKind")},
					},
					Schema: testVersionSchema(t, `{
						"TestKind":{"type":"object","properties":{"spec":{"$ref":"#/components/schemas/spec"},"status":{"$ref":"#/components/schemas/status"}},"required":["spec"]},
						"spec":{"type":"object","additionalProperties":false,"properties":{"testField":{"type":"string"},"foo":{"$ref":"#/components/schemas/Foo"}},"required":["testField","foo"]},
						"status":{"type":"object","additionalProperties":true},
						"Foo":{"type":"object","additionalProperties":false,"properties":{"foo":{"type":"string"},"bar":{"$ref":"#/components/schemas/Bar"}},"required":["foo","bar"]},
						"Bar":{"type":"object","additionalProperties":false,"properties":{"value":{"type":"string"},"baz":{"$ref":"#/components/schemas/Baz"}},"required":["value","baz"]},
						"Baz":{"type":"object","additionalProperties":false,"properties":{"value":{"type":"integer"}},"required":["value"]}
					}`),
				}},
				Routes: app.ManifestVersionRoutes{
					Namespaced: map[string]spec3.PathProps{
						"/foobar": {Get: operation("getFoobar")},
					},
					Cluster: map[string]spec3.PathProps{
						"/foobar": {Get: operation("getClusterFoobar")},
					},
					Schemas: map[string]spec.Schema{},
				},
			},
			{
				Name:   "v2alpha1",
				Served: true,
				Routes: app.ManifestVersionRoutes{
					Namespaced: map[string]spec3.PathProps{
						"/example": {Get: operation("getExample")},
					},
				},
			},
		},
	}
}

func TestGetGroupVersions(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions = append(manifest.Versions, app.ManifestVersion{Name: "unused", Served: false})
	b := &AppPluginAPIBuilder{
		group:      manifest.Group,
		manifest:   manifest,
		pluginJSON: plugins.JSONData{ID: "example-app"},
	}

	require.Equal(t, []schema.GroupVersion{
		{Group: "example.ext.grafana.app", Version: "v1alpha1"},
		{Group: "example.ext.grafana.app", Version: "v0alpha1"},
		{Group: "example.ext.grafana.app", Version: "v2alpha1"},
	}, b.GetGroupVersions())
}

// Shipping a manifest must not move a plugin's existing settings API, so
// v0alpha1 stays served even when the manifest never mentions it.
func TestGetGroupVersionsAlwaysServesSettingsVersion(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions = slices.DeleteFunc(manifest.Versions, func(v app.ManifestVersion) bool {
		return v.Name == apppluginV0.VERSION
	})
	b := &AppPluginAPIBuilder{
		group:      manifest.Group,
		manifest:   manifest,
		pluginJSON: plugins.JSONData{ID: "example-app"},
	}

	require.Equal(t, []schema.GroupVersion{
		{Group: "example.ext.grafana.app", Version: "v1alpha1"},
		{Group: "example.ext.grafana.app", Version: "v2alpha1"},
		{Group: "example.ext.grafana.app", Version: apppluginV0.VERSION},
	}, b.GetGroupVersions(), "the settings version is appended last so it stays non-preferred")
}

func TestGetGroupVersionsFallback(t *testing.T) {
	t.Run("no manifest serves the built-in settings version", func(t *testing.T) {
		b := &AppPluginAPIBuilder{group: "example-app", pluginJSON: plugins.JSONData{ID: "example-app"}}
		require.Equal(t, []schema.GroupVersion{
			{Group: "example-app", Version: apppluginV0.VERSION},
		}, b.GetGroupVersions())
	})

	// An empty version list fails scheme.SetVersionPriority ("must register
	// versions for exactly one group"), which aborts apiserver startup.
	t.Run("a manifest serving nothing still exposes settings", func(t *testing.T) {
		manifest := testManifest(t)
		for i := range manifest.Versions {
			manifest.Versions[i].Served = false
		}
		b := &AppPluginAPIBuilder{
			group:      manifest.Group,
			manifest:   manifest,
			pluginJSON: plugins.JSONData{ID: "example-app"},
		}
		require.Equal(t, []schema.GroupVersion{
			{Group: "example.ext.grafana.app", Version: apppluginV0.VERSION},
		}, b.GetGroupVersions())
	})
}

// The group decides where the plugin's whole API is served, and -- because
// unified storage only always-enforces RBAC on .ext.grafana.app -- whether its
// kinds are access checked at all.
func TestAPIGroupForPlugin(t *testing.T) {
	plugin := func(group string) definition.PluginDefinition {
		d := definition.PluginDefinition{JSONData: plugins.JSONData{ID: "example-app"}}
		if group != "" {
			d.Manifest = &app.ManifestData{AppName: "example", Group: group}
		}
		return d
	}

	t.Run("a manifest group is served as declared", func(t *testing.T) {
		require.Equal(t, "example.ext.grafana.app",
			apiGroupForPlugin(plugin("example.ext.grafana.app")))
	})

	t.Run("no manifest falls back to the plugin id", func(t *testing.T) {
		require.Equal(t, "example-app", apiGroupForPlugin(plugin("")))
	})

	t.Run("a manifest declaring no group is refused", func(t *testing.T) {
		d := definition.PluginDefinition{
			JSONData: plugins.JSONData{ID: "example-app"},
			Manifest: &app.ManifestData{AppName: "example"},
		}
		require.Panics(t, func() { apiGroupForPlugin(d) })
	})

	t.Run("any other suffix is refused", func(t *testing.T) {
		for _, group := range []string{
			"example.ext.grafana.com", // RBAC is never enforced on this one
			"example.grafana.app",
			"example-app",
		} {
			require.Panics(t, func() { apiGroupForPlugin(plugin(group)) }, "group %q", group)
		}
	})
}
