package pluginroute

import (
	"encoding/json"
	"slices"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana-app-sdk/app"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
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
					Schema: testVersionSchema(t, `{
						"TestKind":{"type":"object","properties":{"spec":{"$ref":"#/components/schemas/spec"},"status":{"$ref":"#/components/schemas/status"}},"required":["spec"]},
						"spec":{"type":"object","additionalProperties":false,"properties":{"testField":{"type":"string"},"foo":{"$ref":"#/components/schemas/Foo"}},"required":["testField","foo"]},
						"status":{"type":"object","additionalProperties":true},
						"Foo":{"type":"object","additionalProperties":false,"properties":{"foo":{"type":"string"},"bar":{"$ref":"#/components/schemas/Bar"}},"required":["foo","bar"]},
						"Bar":{"type":"object","additionalProperties":false,"properties":{"value":{"type":"string"},"baz":{"$ref":"#/components/schemas/Baz"}},"required":["value","baz"]},
						"Baz":{"type":"object","additionalProperties":false,"properties":{"value":{"type":"integer"}},"required":["value"]}
					}`),
				}},
				OpenAPI: app.ManifestVersionOpenAPI{Paths: map[string]spec3.PathProps{
					"/foobar":                        {Get: operation("getClusterFoobar")},
					"/namespaces/{namespace}/foobar": {Get: operation("getFoobar")},
					"/namespaces/{namespace}/testkinds/{name}/reload": {Post: operation("reloadTestKind")},
				}},
			},
			{
				Name:   "v2alpha1",
				Served: true,
				OpenAPI: app.ManifestVersionOpenAPI{Paths: map[string]spec3.PathProps{
					"/namespaces/{namespace}/example": {Get: operation("getExample")},
				}},
			},
		},
	}
}

func TestGetGroupVersions(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions = append(manifest.Versions, app.ManifestVersion{Name: "unused", Served: false})
	b := &manifestBuilder{
		group:    manifest.Group,
		manifest: manifest,
		pluginID: "example-app",
	}

	require.Equal(t, []schema.GroupVersion{
		{Group: "example.ext.grafana.app", Version: "v1alpha1"},
		{Group: "example.ext.grafana.app", Version: "v0alpha1"},
		{Group: "example.ext.grafana.app", Version: "v2alpha1"},
	}, b.GetGroupVersions())
}

// Only versions explicitly served by the manifest belong to its group.
func TestGetGroupVersionsWithoutSettings(t *testing.T) {
	manifest := testManifest(t)
	manifest.Versions = slices.DeleteFunc(manifest.Versions, func(v app.ManifestVersion) bool {
		return v.Name == apppluginV0.VERSION
	})
	b := testBuilder(t, manifest)

	require.Equal(t, []schema.GroupVersion{
		{Group: "example.ext.grafana.app", Version: "v1alpha1"},
		{Group: "example.ext.grafana.app", Version: "v2alpha1"},
	}, b.GetGroupVersions(), "settings must not add versions to the manifest group")
}

func TestGetGroupVersionsWithoutServedVersions(t *testing.T) {
	manifest := testManifest(t)
	for i := range manifest.Versions {
		manifest.Versions[i].Served = false
	}
	b := testBuilder(t, manifest)
	require.Empty(t, b.GetGroupVersions())
	require.ErrorContains(t, b.InstallSchema(runtime.NewScheme()), "no served versions")
}
