package openapi

import (
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
)

func manifestFS(content string) fstest.MapFS {
	return fstest.MapFS{appSDKManifestFile: &fstest.MapFile{Data: []byte(content)}}
}

func TestLoadManifest(t *testing.T) {
	t.Run("missing manifest returns nil", func(t *testing.T) {
		m, err := loadManifest(fstest.MapFS{})
		require.NoError(t, err)
		require.Nil(t, m)
	})

	t.Run("v1alpha2", func(t *testing.T) {
		m, err := loadManifest(manifestFS(`{
			"apiVersion": "apps.grafana.app/v1alpha2",
			"kind": "AppManifest",
			"spec": {"appName": "test", "group": "test-app", "versions": []}
		}`))
		require.NoError(t, err)
		require.NotNil(t, m)
		require.Equal(t, "test", m.AppName)
		require.Equal(t, "test-app", m.Group)
	})

	t.Run("v1alpha1", func(t *testing.T) {
		m, err := loadManifest(manifestFS(`{
			"apiVersion": "apps.grafana.app/v1alpha1",
			"kind": "AppManifest",
			"spec": {"appName": "old", "group": "old-app", "versions": []}
		}`))
		require.NoError(t, err)
		require.NotNil(t, m)
		require.Equal(t, "old", m.AppName)
	})

	t.Run("unsupported apiVersion", func(t *testing.T) {
		_, err := loadManifest(manifestFS(`{"apiVersion": "apps.grafana.app/v9beta9", "spec": {}}`))
		require.ErrorContains(t, err, "unsupported AppManifest apiVersion")
	})

	t.Run("malformed json", func(t *testing.T) {
		_, err := loadManifest(manifestFS(`{not json`))
		require.Error(t, err)
	})
}

// A bad manifest must not fail the whole plugin load (it runs during server
// startup): the plugin is served without its manifest kinds instead.
func TestLoadInfoToleratesBadManifest(t *testing.T) {
	info, err := loadInfo(manifestFS(`{not json`), plugins.JSONData{ID: "test-app"}, false, true)
	require.NoError(t, err)
	require.Nil(t, info.Manifest)
	require.Equal(t, "test-app", info.JSONData.ID)
}
