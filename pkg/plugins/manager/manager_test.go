package manager

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

const defaultAppURL = "http://localhost:3000/"

func TestPluginManager_Init(t *testing.T) {
	t.Run("Base case (core + bundled plugins)", func(t *testing.T) {
		staticRootPath, err := filepath.Abs("../../../public")
		require.NoError(t, err)
		bundledPluginsPath, err := filepath.Abs("../../../plugins-bundled/internal")
		require.NoError(t, err)

		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = ""
			pm.Cfg.BundledPluginsPath = bundledPluginsPath
			pm.Cfg.StaticRootPath = staticRootPath
		})
		err = pm.Init()
		require.NoError(t, err)

		assert.Empty(t, pm.scanningErrors)
		verifyCorePluginCatalogue(t, pm)
		verifyBundledPluginCatalogue(t, pm)
	})

	t.Run("Base case with single external plugin", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginSettings = setting.PluginSettings{
				"nginx-app": map[string]string{
					"path": "testdata/test-app",
				},
			}
		})
		err := pm.Init()
		require.NoError(t, err)

		assert.Empty(t, pm.scanningErrors)
		verifyCorePluginCatalogue(t, pm)

		assert.NotEmpty(t, pm.apps)
		assert.Equal(t, "app/plugins/datasource/graphite/module", pm.dataSources["graphite"].Module)
		assert.Equal(t, "public/plugins/test-app/img/logo_large.png", pm.apps["test-app"].Info.Logos.Large)
		assert.Equal(t, "public/plugins/test-app/img/screenshot2.png", pm.apps["test-app"].Info.Screenshots[1].Path)
	})

	t.Run("With external back-end plugin lacking signature (production)", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/unsigned-datasource"
			pm.Cfg.Env = setting.Prod
		})
		err := pm.Init()
		require.NoError(t, err)
		const pluginID = "test"

		assert.Equal(t, []error{fmt.Errorf(`plugin '%s' is unsigned`, pluginID)}, pm.scanningErrors)
		assert.Nil(t, pm.GetDataSource(pluginID))
		assert.Nil(t, pm.GetPlugin(pluginID))
	})

	t.Run("With external back-end plugin lacking signature (development)", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/unsigned-datasource"
			pm.Cfg.Env = setting.Dev
		})
		err := pm.Init()
		require.NoError(t, err)
		const pluginID = "test"

		assert.Empty(t, pm.scanningErrors)
		assert.NotNil(t, pm.GetDataSource(pluginID))

		plugin := pm.GetPlugin(pluginID)
		assert.NotNil(t, plugin)
		assert.Equal(t, plugins.PluginSignatureUnsigned, plugin.Signature)
	})

	t.Run("With external panel plugin lacking signature (production)", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/unsigned-panel"
			pm.Cfg.Env = setting.Prod
		})
		err := pm.Init()
		require.NoError(t, err)
		const pluginID = "test-panel"

		assert.Equal(t, []error{fmt.Errorf(`plugin '%s' is unsigned`, pluginID)}, pm.scanningErrors)
		assert.Nil(t, pm.panels[pluginID])
		assert.Nil(t, pm.GetPlugin(pluginID))
	})

	t.Run("With external panel plugin lacking signature (development)", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/unsigned-panel"
			pm.Cfg.Env = setting.Dev
		})
		err := pm.Init()
		require.NoError(t, err)
		pluginID := "test-panel"

		assert.Empty(t, pm.scanningErrors)
		assert.NotNil(t, pm.panels[pluginID])

		plugin := pm.GetPlugin(pluginID)
		assert.NotNil(t, plugin)
		assert.Equal(t, plugins.PluginSignatureUnsigned, plugin.Signature)
	})

	t.Run("With external unsigned back-end plugin and configuration disabling signature check of this plugin", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/unsigned-datasource"
			pm.Cfg.PluginsAllowUnsigned = []string{"test"}
		})
		err := pm.Init()
		require.NoError(t, err)

		assert.Empty(t, pm.scanningErrors)
	})

	t.Run("With external back-end plugin with invalid v1 signature", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/invalid-v1-signature"
		})
		err := pm.Init()
		require.NoError(t, err)

		const pluginID = "test"
		assert.Equal(t, []error{fmt.Errorf(`plugin '%s' has an invalid signature`, pluginID)}, pm.scanningErrors)
		assert.Nil(t, pm.GetDataSource(pluginID))
		assert.Nil(t, pm.GetPlugin(pluginID))
	})

	t.Run("With external back-end plugin lacking files listed in manifest", func(t *testing.T) {
		fm := &fakeBackendPluginManager{}
		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/lacking-files"
			pm.BackendPluginManager = fm
		})
		err := pm.Init()
		require.NoError(t, err)

		assert.Equal(t, []error{fmt.Errorf(`plugin 'test' has a modified signature`)}, pm.scanningErrors)
	})

	t.Run("Transform plugins should be ignored when expressions feature is off", func(t *testing.T) {
		fm := fakeBackendPluginManager{}
		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/behind-feature-flag"
			pm.BackendPluginManager = &fm
		})
		err := pm.Init()
		require.NoError(t, err)

		assert.Empty(t, pm.scanningErrors)
		assert.Empty(t, fm.registeredPlugins)
	})

	t.Run("With nested plugin duplicating parent", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/duplicate-plugins"
		})
		err := pm.Init()
		require.NoError(t, err)

		assert.Len(t, pm.scanningErrors, 1)
		assert.True(t, errors.Is(pm.scanningErrors[0], plugins.DuplicatePluginError{}))
	})

	t.Run("With external back-end plugin with valid v2 signature", func(t *testing.T) {
		const pluginsDir = "testdata/valid-v2-signature"
		const pluginFolder = pluginsDir + "/plugin"
		pm := createManager(t, func(manager *PluginManager) {
			manager.Cfg.PluginsPath = pluginsDir
		})
		err := pm.Init()
		require.NoError(t, err)
		require.Empty(t, pm.scanningErrors)

		// capture manager plugin state
		datasources := pm.dataSources
		panels := pm.panels
		apps := pm.apps

		verifyPluginManagerState := func() {
			assert.Empty(t, pm.scanningErrors)
			verifyCorePluginCatalogue(t, pm)

			// verify plugin has been loaded successfully
			const pluginID = "test"

			if diff := cmp.Diff(&plugins.PluginBase{
				Type:  "datasource",
				Name:  "Test",
				State: "alpha",
				Id:    pluginID,
				Info: plugins.PluginInfo{
					Author: plugins.PluginInfoLink{
						Name: "Will Browne",
						Url:  "https://willbrowne.com",
					},
					Description: "Test",
					Logos: plugins.PluginLogos{
						Small: "public/img/icn-datasource.svg",
						Large: "public/img/icn-datasource.svg",
					},
					Build:   plugins.PluginBuildInfo{},
					Version: "1.0.0",
				},
				PluginDir:     pluginFolder,
				Backend:       false,
				IsCorePlugin:  false,
				Signature:     plugins.PluginSignatureValid,
				SignatureType: plugins.GrafanaType,
				SignatureOrg:  "Grafana Labs",
				Dependencies: plugins.PluginDependencies{
					GrafanaVersion: "*",
					Plugins:        []plugins.PluginDependencyItem{},
				},
				Module:  "plugins/test/module",
				BaseUrl: "public/plugins/test",
			}, pm.plugins[pluginID]); diff != "" {
				t.Errorf("result mismatch (-want +got) %s\n", diff)
			}

			ds := pm.GetDataSource(pluginID)
			assert.NotNil(t, ds)
			assert.Equal(t, pluginID, ds.Id)
			assert.Equal(t, pm.plugins[pluginID], &ds.FrontendPluginBase.PluginBase)

			assert.Len(t, pm.StaticRoutes(), 1)
			assert.Equal(t, pluginID, pm.StaticRoutes()[0].PluginId)
			assert.Equal(t, pluginFolder, pm.StaticRoutes()[0].Directory)
		}

		verifyPluginManagerState()

		t.Run("Re-initializing external plugins is idempotent", func(t *testing.T) {
			err = pm.initExternalPlugins()
			require.NoError(t, err)

			// verify plugin state remains the same as previous
			verifyPluginManagerState()

			assert.Empty(t, pm.scanningErrors)
			assert.True(t, reflect.DeepEqual(datasources, pm.dataSources))
			assert.True(t, reflect.DeepEqual(panels, pm.panels))
			assert.True(t, reflect.DeepEqual(apps, pm.apps))
		})
	})

	t.Run("With back-end plugin with invalid v2 private signature (mismatched root URL)", func(t *testing.T) {
		origAppURL := setting.AppUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
		})
		setting.AppUrl = "http://localhost:1234"

		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/valid-v2-pvt-signature"
		})
		err := pm.Init()
		require.NoError(t, err)

		assert.Equal(t, []error{fmt.Errorf(`plugin 'test' has an invalid signature`)}, pm.scanningErrors)
		assert.Nil(t, pm.plugins[("test")])
	})

	t.Run("With back-end plugin with valid v2 private signature (plugin root URL ignores trailing slash)", func(t *testing.T) {
		origAppURL := setting.AppUrl
		origAppSubURL := setting.AppSubUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
			setting.AppSubUrl = origAppSubURL
		})
		setting.AppUrl = defaultAppURL
		setting.AppSubUrl = "/grafana"

		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/valid-v2-pvt-signature-root-url-uri"
		})
		err := pm.Init()
		require.NoError(t, err)
		require.Empty(t, pm.scanningErrors)

		const pluginID = "test"
		assert.NotNil(t, pm.plugins[pluginID])
		assert.Equal(t, "datasource", pm.plugins[pluginID].Type)
		assert.Equal(t, "Test", pm.plugins[pluginID].Name)
		assert.Equal(t, pluginID, pm.plugins[pluginID].Id)
		assert.Equal(t, "1.0.0", pm.plugins[pluginID].Info.Version)
		assert.Equal(t, plugins.PluginSignatureValid, pm.plugins[pluginID].Signature)
		assert.Equal(t, plugins.PrivateType, pm.plugins[pluginID].SignatureType)
		assert.Equal(t, "Will Browne", pm.plugins[pluginID].SignatureOrg)
		assert.False(t, pm.plugins[pluginID].IsCorePlugin)
	})

	t.Run("With back-end plugin with valid v2 private signature", func(t *testing.T) {
		origAppURL := setting.AppUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
		})
		setting.AppUrl = defaultAppURL

		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/valid-v2-pvt-signature"
		})
		err := pm.Init()
		require.NoError(t, err)
		require.Empty(t, pm.scanningErrors)

		const pluginID = "test"
		assert.NotNil(t, pm.plugins[pluginID])
		assert.Equal(t, "datasource", pm.plugins[pluginID].Type)
		assert.Equal(t, "Test", pm.plugins[pluginID].Name)
		assert.Equal(t, pluginID, pm.plugins[pluginID].Id)
		assert.Equal(t, "1.0.0", pm.plugins[pluginID].Info.Version)
		assert.Equal(t, plugins.PluginSignatureValid, pm.plugins[pluginID].Signature)
		assert.Equal(t, plugins.PrivateType, pm.plugins[pluginID].SignatureType)
		assert.Equal(t, "Will Browne", pm.plugins[pluginID].SignatureOrg)
		assert.False(t, pm.plugins[pluginID].IsCorePlugin)
	})

	t.Run("With back-end plugin with modified v2 signature (missing file from plugin dir)", func(t *testing.T) {
		origAppURL := setting.AppUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
		})
		setting.AppUrl = defaultAppURL

		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/invalid-v2-signature"
		})
		err := pm.Init()
		require.NoError(t, err)
		assert.Equal(t, []error{fmt.Errorf(`plugin 'test' has a modified signature`)}, pm.scanningErrors)
		assert.Nil(t, pm.plugins[("test")])
	})

	t.Run("With back-end plugin with modified v2 signature (unaccounted file in plugin dir)", func(t *testing.T) {
		origAppURL := setting.AppUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
		})
		setting.AppUrl = defaultAppURL

		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/invalid-v2-signature-2"
		})
		err := pm.Init()
		require.NoError(t, err)
		assert.Equal(t, []error{fmt.Errorf(`plugin 'test' has a modified signature`)}, pm.scanningErrors)
		assert.Nil(t, pm.plugins[("test")])
	})

	t.Run("With back-end plugin with a lib dir that has symbolic links", func(t *testing.T) {
		origAppURL := setting.AppUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
		})
		setting.AppUrl = defaultAppURL

		pm := createManager(t, func(pm *PluginManager) {
			pm.Cfg.PluginsPath = "testdata/symbolic-file-links"
		})
		err := pm.Init()
		require.NoError(t, err)
		// This plugin should be properly registered, even though it has a symbolicly linked file in it.
		require.Empty(t, pm.scanningErrors)
		const pluginID = "test"
		assert.NotNil(t, pm.plugins[pluginID])
		assert.Equal(t, "datasource", pm.plugins[pluginID].Type)
		assert.Equal(t, "Test", pm.plugins[pluginID].Name)
		assert.Equal(t, pluginID, pm.plugins[pluginID].Id)
		assert.Equal(t, "1.0.0", pm.plugins[pluginID].Info.Version)
		assert.Equal(t, plugins.PluginSignatureValid, pm.plugins[pluginID].Signature)
		assert.Equal(t, plugins.GrafanaType, pm.plugins[pluginID].SignatureType)
		assert.Equal(t, "Grafana Labs", pm.plugins[pluginID].SignatureOrg)
		assert.False(t, pm.plugins[pluginID].IsCorePlugin)
		assert.NotNil(t, pm.plugins[("test")])
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

func TestPluginManager_Installer(t *testing.T) {
	t.Run("Install plugin after manager init", func(t *testing.T) {
		fm := &fakeBackendPluginManager{}
		pm := createManager(t, func(pm *PluginManager) {
			pm.BackendPluginManager = fm
		})

		err := pm.Init()
		require.NoError(t, err)

		// mock installer
		installer := &fakePluginInstaller{}
		pm.pluginInstaller = installer

		// Set plugin location (we do this after manager Init() so that
		// it doesn't install the plugin automatically)
		pm.Cfg.PluginsPath = "testdata/installer"

		pluginID := "test"
		pluginFolder := pm.Cfg.PluginsPath + "/plugin"

		err = pm.Install(context.Background(), pluginID, "1.0.0")
		require.NoError(t, err)

		assert.Equal(t, 1, installer.installCount)
		assert.Equal(t, 0, installer.uninstallCount)

		// verify plugin manager has loaded core plugins successfully
		assert.Empty(t, pm.scanningErrors)
		verifyCorePluginCatalogue(t, pm)

		// verify plugin has been loaded successfully
		assert.NotNil(t, pm.plugins[pluginID])
		if diff := cmp.Diff(&plugins.PluginBase{
			Type:  "datasource",
			Name:  "Test",
			State: "alpha",
			Id:    pluginID,
			Info: plugins.PluginInfo{
				Author: plugins.PluginInfoLink{
					Name: "Will Browne",
					Url:  "https://willbrowne.com",
				},
				Description: "Test",
				Logos: plugins.PluginLogos{
					Small: "public/img/icn-datasource.svg",
					Large: "public/img/icn-datasource.svg",
				},
				Build:   plugins.PluginBuildInfo{},
				Version: "1.0.0",
			},
			PluginDir:     pluginFolder,
			Backend:       false,
			IsCorePlugin:  false,
			Signature:     plugins.PluginSignatureValid,
			SignatureType: plugins.GrafanaType,
			SignatureOrg:  "Grafana Labs",
			Dependencies: plugins.PluginDependencies{
				GrafanaVersion: "*",
				Plugins:        []plugins.PluginDependencyItem{},
			},
			Module:  "plugins/test/module",
			BaseUrl: "public/plugins/test",
		}, pm.plugins[pluginID]); diff != "" {
			t.Errorf("result mismatch (-want +got) %s\n", diff)
		}

		ds := pm.GetDataSource(pluginID)
		assert.NotNil(t, ds)
		assert.Equal(t, pluginID, ds.Id)
		assert.Equal(t, pm.plugins[pluginID], &ds.FrontendPluginBase.PluginBase)

		assert.Len(t, pm.StaticRoutes(), 1)
		assert.Equal(t, pluginID, pm.StaticRoutes()[0].PluginId)
		assert.Equal(t, pluginFolder, pm.StaticRoutes()[0].Directory)

		t.Run("Won't install if already installed", func(t *testing.T) {
			err := pm.Install(context.Background(), pluginID, "1.0.0")
			require.Equal(t, plugins.DuplicatePluginError{
				PluginID:          pluginID,
				ExistingPluginDir: pluginFolder,
			}, err)
		})

		t.Run("Uninstall base case", func(t *testing.T) {
			err := pm.Uninstall(context.Background(), pluginID)
			require.NoError(t, err)

			assert.Equal(t, 1, installer.installCount)
			assert.Equal(t, 1, installer.uninstallCount)

			assert.Nil(t, pm.GetDataSource(pluginID))
			assert.Nil(t, pm.GetPlugin(pluginID))
			assert.Len(t, pm.StaticRoutes(), 0)

			t.Run("Won't uninstall if not installed", func(t *testing.T) {
				err := pm.Uninstall(context.Background(), pluginID)
				require.Equal(t, plugins.ErrPluginNotInstalled, err)
			})
		})
	})
}

func verifyCorePluginCatalogue(t *testing.T, pm *PluginManager) {
	t.Helper()

	panels := []string{
		"alertlist",
		"annolist",
		"barchart",
		"bargauge",
		"dashlist",
		"debug",
		"gauge",
		"gettingstarted",
		"graph",
		"heatmap",
		"live",
		"logs",
		"news",
		"nodeGraph",
		"piechart",
		"pluginlist",
		"stat",
		"table",
		"table-old",
		"text",
		"state-timeline",
		"status-history",
		"timeseries",
		"welcome",
		"xychart",
	}

	datasources := []string{
		"alertmanager",
		"stackdriver",
		"cloudwatch",
		"dashboard",
		"elasticsearch",
		"grafana",
		"grafana-azure-monitor-datasource",
		"graphite",
		"influxdb",
		"jaeger",
		"loki",
		"mixed",
		"mssql",
		"mysql",
		"opentsdb",
		"postgres",
		"prometheus",
		"tempo",
		"testdata",
		"zipkin",
	}

	for _, p := range panels {
		assert.NotNil(t, pm.plugins[p])
		assert.NotNil(t, pm.panels[p])
	}

	for _, ds := range datasources {
		assert.NotNil(t, pm.plugins[ds])
		assert.NotNil(t, pm.dataSources[ds])
	}
}

func verifyBundledPluginCatalogue(t *testing.T, pm *PluginManager) {
	t.Helper()

	bundledPlugins := map[string]string{
		"input":                    "input-datasource",
		"grafana-plugin-admin-app": "plugin-admin-app",
	}

	for pluginID, pluginDir := range bundledPlugins {
		assert.NotNil(t, pm.plugins[pluginID])
		for _, route := range pm.staticRoutes {
			if pluginID == route.PluginId {
				assert.True(t, strings.HasPrefix(route.Directory, pm.Cfg.BundledPluginsPath+"/"+pluginDir))
			}
		}
	}

	assert.NotNil(t, pm.dataSources["input"])
	assert.NotNil(t, pm.apps["grafana-plugin-admin-app"])
}

type fakeBackendPluginManager struct {
	registeredPlugins []string
}

func (f *fakeBackendPluginManager) Register(pluginID string, factory backendplugin.PluginFactoryFunc) error {
	f.registeredPlugins = append(f.registeredPlugins, pluginID)
	return nil
}

func (f *fakeBackendPluginManager) RegisterAndStart(ctx context.Context, pluginID string, factory backendplugin.PluginFactoryFunc) error {
	f.registeredPlugins = append(f.registeredPlugins, pluginID)
	return nil
}

func (f *fakeBackendPluginManager) Get(pluginID string) (backendplugin.Plugin, bool) {
	return nil, false
}

func (f *fakeBackendPluginManager) UnregisterAndStop(ctx context.Context, pluginID string) error {
	var result []string

	for _, existingPlugin := range f.registeredPlugins {
		if pluginID != existingPlugin {
			result = append(result, pluginID)
		}
	}

	f.registeredPlugins = result
	return nil
}

func (f *fakeBackendPluginManager) IsRegistered(pluginID string) bool {
	for _, existingPlugin := range f.registeredPlugins {
		if pluginID == existingPlugin {
			return true
		}
	}
	return false
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

func (f *fakeBackendPluginManager) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	return nil, nil
}

func (f *fakeBackendPluginManager) CallResource(pluginConfig backend.PluginContext, ctx *models.ReqContext, path string) {
}

var _ backendplugin.Manager = &fakeBackendPluginManager{}

type fakePluginInstaller struct {
	installCount   int
	uninstallCount int
}

func (f *fakePluginInstaller) Install(ctx context.Context, pluginID, version, pluginsDirectory, pluginZipURL, pluginRepoURL string) error {
	f.installCount++
	return nil
}

func (f *fakePluginInstaller) Uninstall(ctx context.Context, pluginID, pluginPath string) error {
	f.uninstallCount++
	return nil
}

func createManager(t *testing.T, cbs ...func(*PluginManager)) *PluginManager {
	t.Helper()

	staticRootPath, err := filepath.Abs("../../../public/")
	require.NoError(t, err)

	pm := newManager(&setting.Cfg{
		Raw:            ini.Empty(),
		Env:            setting.Prod,
		StaticRootPath: staticRootPath,
	})
	pm.BackendPluginManager = &fakeBackendPluginManager{}
	for _, cb := range cbs {
		cb(pm)
	}

	return pm
}
