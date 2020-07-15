package plugins

import (
	"context"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestPluginManager_Init(t *testing.T) {
	origRootPath := setting.StaticRootPath
	origRaw := setting.Raw
	origEnv := setting.Env
	t.Cleanup(func() {
		setting.StaticRootPath = origRootPath
		setting.Raw = origRaw
		setting.Env = origEnv
	})

	var err error
	setting.StaticRootPath, err = filepath.Abs("../../public/")
	require.NoError(t, err)
	setting.Raw = ini.Empty()
	setting.Env = setting.PROD

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

		assert.Empty(t, pm.scanningErrors)
		assert.Greater(t, len(DataSources), 1)
		assert.Greater(t, len(Panels), 1)
		assert.Equal(t, "app/plugins/datasource/graphite/module", DataSources["graphite"].Module)
		assert.NotEmpty(t, Apps)
		assert.Equal(t, "public/plugins/test-app/img/logo_large.png", Apps["test-app"].Info.Logos.Large)
		assert.Equal(t, "public/plugins/test-app/img/screenshot2.png", Apps["test-app"].Info.Screenshots[1].Path)
	})

	t.Run("With external back-end plugin lacking signature", func(t *testing.T) {
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

	t.Run("With external unsigned back-end plugin and configuration disabling signature check of this plugin", func(t *testing.T) {
		origPluginsPath := setting.PluginsPath
		t.Cleanup(func() {
			setting.PluginsPath = origPluginsPath
		})
		setting.PluginsPath = "testdata/unsigned"

		pm := &PluginManager{
			Cfg: &setting.Cfg{
				PluginsAllowUnsigned: []string{"test"},
			},
			BackendPluginManager: &fakeBackendPluginManager{},
		}
		err := pm.Init()
		require.NoError(t, err)

		assert.Empty(t, pm.scanningErrors)
	})

	t.Run("With external back-end plugin with invalid signature", func(t *testing.T) {
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

	t.Run("With external back-end plugin lacking files listed in manifest", func(t *testing.T) {
		origPluginsPath := setting.PluginsPath
		t.Cleanup(func() {
			setting.PluginsPath = origPluginsPath
		})
		setting.PluginsPath = "testdata/lacking-files"

		fm := &fakeBackendPluginManager{}
		pm := &PluginManager{
			Cfg:                  &setting.Cfg{},
			BackendPluginManager: fm,
		}
		err := pm.Init()
		require.NoError(t, err)

		assert.Equal(t, []error{fmt.Errorf(`plugin "test"'s signature has been modified`)}, pm.scanningErrors)
	})

	t.Run("Transform plugins should be ignored when expressions feature is off", func(t *testing.T) {
		origPluginsPath := setting.PluginsPath
		t.Cleanup(func() {
			setting.PluginsPath = origPluginsPath
		})
		setting.PluginsPath = "testdata/behind-feature-flag"

		fm := fakeBackendPluginManager{}
		pm := &PluginManager{
			Cfg:                  &setting.Cfg{},
			BackendPluginManager: &fm,
		}
		err := pm.Init()
		require.NoError(t, err)

		assert.Empty(t, pm.scanningErrors)
		assert.Empty(t, fm.registeredPlugins)
	})

	t.Run("Transform plugins should be loaded when expressions feature is on", func(t *testing.T) {
		origPluginsPath := setting.PluginsPath
		t.Cleanup(func() {
			setting.PluginsPath = origPluginsPath
		})
		setting.PluginsPath = "testdata/behind-feature-flag"

		fm := &fakeBackendPluginManager{}
		pm := &PluginManager{
			Cfg: &setting.Cfg{
				FeatureToggles: map[string]bool{
					"expressions": true,
				},
			},
			BackendPluginManager: fm,
		}
		err := pm.Init()
		require.NoError(t, err)

		require.Empty(t, pm.scanningErrors)
		assert.Equal(t, []string{"gel"}, fm.registeredPlugins)
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

type fakeBackendPluginManager struct {
	registeredPlugins []string
}

func (f *fakeBackendPluginManager) Register(pluginID string, factory backendplugin.PluginFactoryFunc) error {
	f.registeredPlugins = append(f.registeredPlugins, pluginID)
	return nil
}

func (f *fakeBackendPluginManager) StartPlugin(ctx context.Context, pluginID string) error {
	return nil
}

func (f *fakeBackendPluginManager) CollectMetrics(ctx context.Context, pluginID string) (*backend.CollectMetricsResult, error) {
	return nil, nil
}

func (f *fakeBackendPluginManager) CheckHealth(ctx context.Context, pCtx backend.PluginContext) (*backend.CheckHealthResult, error) {
	return nil, nil
}

func (f *fakeBackendPluginManager) CallResource(pluginConfig backend.PluginContext, ctx *models.ReqContext, path string) {
}
