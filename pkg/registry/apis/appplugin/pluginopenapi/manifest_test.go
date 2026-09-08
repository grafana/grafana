package pluginopenapi

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

// A manifest on its own is enough to render from: the app name stands in for
// the plugin ID, and the manifest group is what the APIs are served under.
func TestLoadManifestStandalone(t *testing.T) {
	plugin, err := LoadManifest(context.Background(), "testdata/standalone/app-sdk-manifest.json")
	require.NoError(t, err)

	require.Equal(t, "example-app", plugin.JSONData.ID)
	require.NotNil(t, plugin.Manifest)
	require.Equal(t, "example-app", plugin.Manifest.AppName)
	require.Empty(t, plugin.JSONData.Info.Version, "there is no plugin.json to take a version from")

	versions, err := Versions(plugin, Options{})
	require.NoError(t, err)
	require.Equal(t, []string{"v1alpha1", "v0alpha1"}, versions,
		"the unserved manifest version is left out, and the settings version is served last")

	oas, err := Build(plugin, "v1alpha1", Options{})
	require.NoError(t, err)
	require.Equal(t, "example.ext.grafana.app/v1alpha1", oas.Info.Title)
	require.Contains(t, oas.Paths.Paths, "/apis/example.ext.grafana.app/v1alpha1/namespaces/{namespace}/testkinds")
}

// A built plugin has its plugin.json beside the manifest, and that is where the
// plugin ID comes from, but the APIs are still served under the manifest group.
func TestLoadManifestBesidePluginJSON(t *testing.T) {
	plugin, err := LoadManifest(context.Background(), "testdata/plugin/app-sdk-manifest.json")
	require.NoError(t, err)

	require.Equal(t, "grafana-example-app", plugin.JSONData.ID)
	require.Equal(t, "4.5.6", plugin.JSONData.Info.Version)
	require.Equal(t, "example-app", plugin.Manifest.AppName, "the manifest is still the one that was named")

	oas, err := Build(plugin, "v1alpha1", Options{})
	require.NoError(t, err)
	require.Equal(t, "example.ext.grafana.app/v1alpha1", oas.Info.Title)
	require.Equal(t, "An example app plugin", oas.Info.Description)
	require.Contains(t, oas.Paths.Paths, "/apis/example.ext.grafana.app/v1alpha1/namespaces/{namespace}/testkinds")
}

// The file the caller named is the one that is read, even when the directory
// holds another manifest under the conventional name.
func TestLoadManifestNamedFileWins(t *testing.T) {
	dir := t.TempDir()
	named := filepath.Join(dir, "other-manifest.json")

	require.NoError(t, os.WriteFile(named, []byte(
		`{"apiVersion":"apps.grafana.app/v1alpha2","kind":"AppManifest",`+
			`"spec":{"appName":"named-app","versions":[{"name":"v1alpha1","served":true}]}}`), 0600))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "app-sdk-manifest.json"), []byte("{}"), 0600))

	plugin, err := LoadManifest(context.Background(), named)
	require.NoError(t, err)
	require.Equal(t, "named-app", plugin.JSONData.ID)
}

func TestLoadManifestErrors(t *testing.T) {
	t.Run("missing file", func(t *testing.T) {
		_, err := LoadManifest(context.Background(), "testdata/nope.json")
		require.ErrorIs(t, err, os.ErrNotExist)
	})

	t.Run("not a manifest", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "app-sdk-manifest.json")
		require.NoError(t, os.WriteFile(path, []byte(`{"hello":"world"}`), 0600))

		_, err := LoadManifest(context.Background(), path)
		require.ErrorContains(t, err, "unsupported AppManifest apiVersion")
	})

	t.Run("no app name to fall back on", func(t *testing.T) {
		path := filepath.Join(t.TempDir(), "app-sdk-manifest.json")
		require.NoError(t, os.WriteFile(path, []byte(
			`{"apiVersion":"apps.grafana.app/v1alpha2","kind":"AppManifest","spec":{}}`), 0600))

		_, err := LoadManifest(context.Background(), path)
		require.ErrorContains(t, err, "no appName")
	})
}
