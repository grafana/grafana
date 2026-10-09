package definition

import (
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	"github.com/grafana/grafana-app-sdk/app"
)

func TestMigrateDeprecatedRoutes(t *testing.T) {
	get := spec3.PathProps{Get: &spec3.Operation{}}

	t.Run("deprecated routes become OpenAPI paths", func(t *testing.T) {
		manifest := &app.ManifestData{Versions: []app.ManifestVersion{{
			Name: "v1",
			Kinds: []app.ManifestVersionKind{
				{Kind: "Thing", Plural: "Things", Scope: "Namespaced", Routes: map[string]spec3.PathProps{"/reload": get}},
				{Kind: "Node", Plural: "Nodes", Scope: "Cluster", Routes: map[string]spec3.PathProps{"rebuild": get}},
			},
			Routes: app.ManifestVersionRoutes{ //nolint:staticcheck // SA1019: the input being migrated.
				Cluster:    map[string]spec3.PathProps{"/status": get},
				Namespaced: map[string]spec3.PathProps{"report": get},
				Schemas:    map[string]spec.Schema{"Report": *spec.StringProperty(), "Shared": *spec.BoolProperty()},
			},
			OpenAPI: app.ManifestVersionOpenAPI{Components: app.ManifestVersionOpenAPIComponents{
				Schemas: map[string]spec.Schema{"Shared": *spec.Int64Property()},
			}},
		}}}
		MigrateDeprecatedRoutes(manifest)

		version := manifest.Versions[0]
		require.Equal(t, map[string]spec3.PathProps{
			"/status":                        get,
			"/namespaces/{namespace}/report": get,
			"/namespaces/{namespace}/things/{name}/reload": get,
			"/nodes/{name}/rebuild":                        get,
		}, version.OpenAPI.Paths)
		require.Equal(t, map[string]spec.Schema{
			"Report": *spec.StringProperty(),
			"Shared": *spec.Int64Property(),
		}, version.OpenAPI.Components.Schemas, "OpenAPI components win over route schemas")
		require.Equal(t, app.ManifestVersionRoutes{}, version.Routes) //nolint:staticcheck // SA1019: checking it is cleared.
	})

	t.Run("existing OpenAPI paths are authoritative", func(t *testing.T) {
		paths := map[string]spec3.PathProps{"/current": get}
		manifest := &app.ManifestData{Versions: []app.ManifestVersion{{
			Name: "v1",
			Kinds: []app.ManifestVersionKind{{
				Kind: "Thing", Plural: "Things", Scope: "Namespaced",
				Routes: map[string]spec3.PathProps{"/stale": get},
			}},
			Routes:  app.ManifestVersionRoutes{Cluster: map[string]spec3.PathProps{"/stale": get}}, //nolint:staticcheck // SA1019: the input being migrated.
			OpenAPI: app.ManifestVersionOpenAPI{Paths: paths},
		}}}
		MigrateDeprecatedRoutes(manifest)
		require.Equal(t, paths, manifest.Versions[0].OpenAPI.Paths)
		require.Equal(t, app.ManifestVersionRoutes{}, manifest.Versions[0].Routes) //nolint:staticcheck // SA1019: checking it is cleared.
	})

	t.Run("a version without routes is left alone", func(t *testing.T) {
		manifest := &app.ManifestData{Versions: []app.ManifestVersion{{Name: "v1"}}}
		MigrateDeprecatedRoutes(manifest)
		require.Nil(t, manifest.Versions[0].OpenAPI.Paths)
		MigrateDeprecatedRoutes(nil)
	})
}

// Every manifest read from a file is migrated, so nothing downstream sees the
// deprecated routes.
func TestParseManifestMigratesDeprecatedRoutes(t *testing.T) {
	manifest, err := ParseManifest([]byte(`{
		"apiVersion": "apps.grafana.app/v1alpha2", "kind": "AppManifest",
		"spec": {"appName": "example", "group": "example.ext.grafana.app", "versions": [{
			"name": "v1", "served": true,
			"routes": {"namespaced": {"/ping": {"get": {"responses": {"200": {"description": "OK"}}}}}}
		}]}
	}`))
	require.NoError(t, err)
	version := manifest.Versions[0]
	require.Contains(t, version.OpenAPI.Paths, "/namespaces/{namespace}/ping")
	require.Equal(t, app.ManifestVersionRoutes{}, version.Routes) //nolint:staticcheck // SA1019: checking it is cleared.
}
