package plugins

import (
	"fmt"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestPluginManager_Init(t *testing.T) {
	origRootPath := setting.StaticRootPath
	origRaw := setting.Raw
	t.Cleanup(func() {
		setting.StaticRootPath = origRootPath
		setting.Raw = origRaw
	})

	var err error
	setting.StaticRootPath, err = filepath.Abs("../../public/")
	require.NoError(t, err)
	setting.Raw = ini.Empty()

	t.Run("Base case", func(t *testing.T) {
		pm := &PluginManager{
			Cfg: &setting.Cfg{
				PluginSettings: setting.PluginSettings{
					"nginx-app": map[string]string{
						"path": "testdata/test-app",
					},
				},
			},
		}
		err := pm.Init()
		require.NoError(t, err)

		assert.Greater(t, len(DataSources), 1)
		assert.Greater(t, len(Panels), 1)
		assert.Equal(t, "app/plugins/datasource/graphite/module", DataSources["graphite"].Module)
		assert.NotEmpty(t, Apps)
		assert.Equal(t, "public/plugins/test-app/img/logo_large.png", Apps["test-app"].Info.Logos.Large)
		assert.Equal(t, "public/plugins/test-app/img/screenshot2.png", Apps["test-app"].Info.Screenshots[1].Path)
	})

	t.Run("With external plugin lacking signature", func(t *testing.T) {
		origPluginsPath := setting.PluginsPath
		t.Cleanup(func() {
			setting.PluginsPath = origPluginsPath
		})
		setting.PluginsPath = "testdata/unsigned"

		pm := &PluginManager{
			Cfg: &setting.Cfg{},
		}
		err := pm.Init()
		require.NoError(t, err)

		assert.Equal(t, []error{fmt.Errorf(`plugin "test" is unsigned`)}, pm.scanningErrors)
	})

	t.Run("With external plugin with invalid signature", func(t *testing.T) {
		origPluginsPath := setting.PluginsPath
		t.Cleanup(func() {
			setting.PluginsPath = origPluginsPath
		})
		setting.PluginsPath = "testdata/invalid-signature"

		pm := &PluginManager{
			Cfg: &setting.Cfg{},
		}
		err := pm.Init()
		require.NoError(t, err)

		assert.Equal(t, []error{fmt.Errorf(`plugin "test" has an invalid signature`)}, pm.scanningErrors)
	})
}

func TestPluginManager_IsBackendOnlyPlugin(t *testing.T) {
	pluginScanner := &PluginScanner{}

	type testCase struct {
		name          string
		isBackendOnly bool
	}

	for _, c := range []testCase{
		{name: "renderer", isBackendOnly: true},
		{name: "app", isBackendOnly: false},
	} {
		t.Run(fmt.Sprintf("Plugin %s", c.name), func(t *testing.T) {
			result := pluginScanner.IsBackendOnlyPlugin(c.name)

			assert.Equal(t, c.isBackendOnly, result)
		})
	}
}
