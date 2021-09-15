package manager

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-aws-sdk/pkg/awsds"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins/manager/installer"

	"github.com/google/go-cmp/cmp"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/services/sqlstore"
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
			pm.cfg.PluginsPath = ""
			pm.cfg.BundledPluginsPath = bundledPluginsPath
			pm.cfg.StaticRootPath = staticRootPath
		})
		err = pm.init()
		require.NoError(t, err)

		verifyNoPluginErrors(t, pm)
		verifyCorePluginCatalogue(t, pm)
		verifyBundledPlugins(t, pm)
	})

	t.Run("Base case with single external plugin", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginSettings = setting.PluginSettings{
				"nginx-app": map[string]string{
					"path": "testdata/test-app",
				},
			}
		})
		err := pm.init()
		require.NoError(t, err)

		verifyNoPluginErrors(t, pm)
		verifyCorePluginCatalogue(t, pm)

		assert.NotEmpty(t, pm.Plugins())
		assert.Equal(t, "app/plugins/datasource/graphite/module", pm.Plugin("graphite").Module)
		assert.Equal(t, "public/plugins/test-app/img/logo_large.png", pm.Plugin("test-app").Info.Logos.Large)
		assert.Equal(t, "public/plugins/test-app/img/screenshot2.png", pm.Plugin("test-app").Info.Screenshots[1].Path)
	})

	t.Run("With external back-end plugin lacking signature (production)", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/unsigned-datasource"
			pm.cfg.Env = setting.Prod
		})
		err := pm.init()
		require.NoError(t, err)
		const pluginID = "test"

		assert.Equal(t, []error{fmt.Errorf(`plugin '%s' is unsigned`, pluginID)}, pm.Plugin(pluginID).SignatureError)
		assert.Nil(t, pm.Plugin(pluginID))
	})

	t.Run("With external back-end plugin lacking signature (development)", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/unsigned-datasource"
			pm.cfg.Env = setting.Dev
		})
		err := pm.init()
		require.NoError(t, err)
		const pluginID = "test"

		verifyNoPluginErrors(t, pm)

		plugin := pm.Plugin(pluginID)
		assert.NotNil(t, plugin)
		assert.Equal(t, plugins.SignatureUnsigned, plugin.Signature)
	})

	t.Run("With external panel plugin lacking signature (production)", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/unsigned-panel"
			pm.cfg.Env = setting.Prod
		})
		err := pm.init()
		require.NoError(t, err)
		const pluginID = "test-panel"

		assert.Equal(t, []error{fmt.Errorf(`plugin '%s' is unsigned`, pluginID)}, pm.Plugin(pluginID).SignatureError)
		assert.Nil(t, pm.Plugin(pluginID))
	})

	t.Run("With external panel plugin lacking signature (development)", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/unsigned-panel"
			pm.cfg.Env = setting.Dev
		})
		err := pm.init()
		require.NoError(t, err)
		pluginID := "test-panel"

		verifyNoPluginErrors(t, pm)

		plugin := pm.Plugin(pluginID)
		assert.NotNil(t, plugin)
		assert.Equal(t, plugins.SignatureUnsigned, plugin.Signature)
	})

	t.Run("With external unsigned back-end plugin and configuration disabling signature check of this plugin", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/unsigned-datasource"
			pm.cfg.PluginsAllowUnsigned = []string{"test"}
		})
		err := pm.init()
		require.NoError(t, err)

		verifyNoPluginErrors(t, pm)
	})

	t.Run("With external back-end plugin with invalid v1 signature", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/invalid-v1-signature"
		})
		err := pm.init()
		require.NoError(t, err)

		const pluginID = "test"
		assert.Equal(t, []error{fmt.Errorf(`plugin '%s' has an invalid signature`, pluginID)}, pm.Plugin(pluginID).SignatureError)
		assert.Nil(t, pm.Plugin(pluginID))
	})

	t.Run("With external back-end plugin lacking files listed in manifest", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/lacking-files"
		})
		err := pm.init()
		require.NoError(t, err)

		const pluginID = "test"
		assert.Equal(t, []error{fmt.Errorf(`plugin 'test' has a modified signature`)}, pm.Plugin(pluginID).SignatureError)
	})

	t.Run("With nested plugin duplicating parent", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/duplicate-plugins"
		})
		err := pm.init()
		require.NoError(t, err)

		assert.Len(t, pm.scanningErrors, 1)
		assert.True(t, errors.Is(pm.scanningErrors[0], plugins.DuplicatePluginError{}))
	})

	t.Run("With external back-end plugin with valid v2 signature", func(t *testing.T) {
		const pluginsDir = "testdata/valid-v2-signature"
		const pluginFolder = pluginsDir + "/plugin"
		pm := createManager(t, func(manager *PluginManager) {
			manager.cfg.PluginsPath = pluginsDir
		})
		err := pm.init()
		require.NoError(t, err)
		verifyNoPluginErrors(t, pm)

		// capture manager plugin state
		pluginsPre := pm.Plugins()

		verifyPluginManagerState := func() {
			verifyNoPluginErrors(t, pm)
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
						URL:  "https://willbrowne.com",
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
				Signature:     plugins.SignatureValid,
				SignatureType: plugins.GrafanaType,
				SignatureOrg:  "Grafana Labs",
				SignedFiles:   plugins.PluginFiles{"plugin.json": {}},
				Dependencies: plugins.PluginDependencies{
					GrafanaVersion: "*",
					Plugins:        []plugins.PluginDependencyItem{},
				},
				Module:  "plugins/test/module",
				BaseUrl: "public/plugins/test",
			}, pm.plugins[pluginID]); diff != "" {
				t.Errorf("result mismatch (-want +got) %s\n", diff)
			}

			ds := pm.Plugin(pluginID)
			assert.NotNil(t, ds)
			assert.Equal(t, pluginID, ds.ID)
			assert.Equal(t, pm.plugins[pluginID], &ds)

			assert.Len(t, pm.Routes(), 1)
			assert.Equal(t, pluginID, pm.Routes()[0].PluginID)
			assert.Equal(t, pluginFolder, pm.Routes()[0].Directory)
		}

		verifyPluginManagerState()

		t.Run("Re-initializing external plugins is idempotent", func(t *testing.T) {
			err = pm.init() //pm.loadPlugins(pm.cfg.PluginsPath)
			require.NoError(t, err)

			// verify plugin state remains the same as previous
			verifyPluginManagerState()
			verifyNoPluginErrors(t, pm)

			pluginsPost := pm.Plugins()

			assert.True(t, reflect.DeepEqual(pluginsPre, pluginsPost))
		})
	})

	t.Run("With back-end plugin with invalid v2 private signature (mismatched root URL)", func(t *testing.T) {
		origAppURL := setting.AppUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
		})
		setting.AppUrl = "http://localhost:1234"

		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/valid-v2-pvt-signature"
		})
		err := pm.init()
		require.NoError(t, err)

		const pluginID = "test"
		assert.Equal(t, []error{fmt.Errorf(`plugin 'test' has an invalid signature`)}, pm.Plugin(pluginID).SignatureError)
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
			pm.cfg.PluginsPath = "testdata/valid-v2-pvt-signature-root-url-uri"
		})
		err := pm.init()
		require.NoError(t, err)
		verifyNoPluginErrors(t, pm)

		const pluginID = "test"
		assert.NotNil(t, pm.plugins[pluginID])
		assert.Equal(t, "datasource", pm.plugins[pluginID].Type)
		assert.Equal(t, "Test", pm.plugins[pluginID].Name)
		assert.Equal(t, pluginID, pm.plugins[pluginID].ID)
		assert.Equal(t, "1.0.0", pm.plugins[pluginID].Info.Version)
		assert.Equal(t, plugins.SignatureValid, pm.plugins[pluginID].Signature)
		assert.Equal(t, plugins.PrivateType, pm.plugins[pluginID].SignatureType)
		assert.Equal(t, "Will Browne", pm.plugins[pluginID].SignatureOrg)
		assert.False(t, pm.Plugin(pluginID).IsCorePlugin())
	})

	t.Run("With back-end plugin with valid v2 private signature", func(t *testing.T) {
		origAppURL := setting.AppUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
		})
		setting.AppUrl = defaultAppURL

		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/valid-v2-pvt-signature"
		})
		err := pm.init()
		require.NoError(t, err)
		verifyNoPluginErrors(t, pm)

		const pluginID = "test"
		assert.NotNil(t, pm.plugins[pluginID])
		assert.Equal(t, pluginID, pm.plugins[pluginID].ID)
		assert.Equal(t, "datasource", pm.plugins[pluginID].Type)
		assert.Equal(t, "Test", pm.plugins[pluginID].Name)
		assert.Equal(t, "1.0.0", pm.plugins[pluginID].Info.Version)
		assert.Equal(t, plugins.SignatureValid, pm.plugins[pluginID].Signature)
		assert.Equal(t, plugins.PrivateType, pm.plugins[pluginID].SignatureType)
		assert.Equal(t, "Will Browne", pm.plugins[pluginID].SignatureOrg)
		assert.False(t, pm.Plugin(pluginID).IsCorePlugin())
	})

	t.Run("With back-end plugin with modified v2 signature (missing file from plugin dir)", func(t *testing.T) {
		origAppURL := setting.AppUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
		})
		setting.AppUrl = defaultAppURL

		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/invalid-v2-signature"
		})
		err := pm.init()
		require.NoError(t, err)

		const pluginID = "test"
		assert.Equal(t, []error{fmt.Errorf(`plugin 'test' has a modified signature`)}, pm.Plugin(pluginID).SignatureError)
		assert.Nil(t, pm.plugins[("test")])
	})

	t.Run("With back-end plugin with modified v2 signature (unaccounted file in plugin dir)", func(t *testing.T) {
		origAppURL := setting.AppUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
		})
		setting.AppUrl = defaultAppURL

		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/invalid-v2-signature-2"
		})
		err := pm.init()
		require.NoError(t, err)

		const pluginID = "test"
		assert.Equal(t, []error{fmt.Errorf(`plugin 'test' has a modified signature`)}, pm.Plugin(pluginID).SignatureError)
		assert.Nil(t, pm.plugins[("test")])
	})

	t.Run("With plugin that contains symlink file + directory", func(t *testing.T) {
		origAppURL := setting.AppUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
		})
		setting.AppUrl = defaultAppURL

		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/includes-symlinks"
		})
		err := pm.init()
		require.NoError(t, err)
		verifyNoPluginErrors(t, pm)

		const pluginID = "test-app"
		p := pm.Plugin(pluginID)

		assert.NotNil(t, p)
		assert.Equal(t, pluginID, p.ID)
		assert.Equal(t, "app", p.Type)
		assert.Equal(t, "Test App", p.Name)
		assert.Equal(t, "1.0.0", p.Info.Version)
		assert.Equal(t, plugins.SignatureValid, p.Signature)
		assert.Equal(t, plugins.GrafanaType, p.SignatureType)
		assert.Equal(t, "Grafana Labs", p.SignatureOrg)
		assert.False(t, p.IsCorePlugin())
	})

	t.Run("With back-end plugin that is symlinked to plugins dir", func(t *testing.T) {
		origAppURL := setting.AppUrl
		t.Cleanup(func() {
			setting.AppUrl = origAppURL
		})
		setting.AppUrl = defaultAppURL

		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = "testdata/symbolic-plugin-dirs"
		})
		err := pm.init()
		require.NoError(t, err)
		// This plugin should be properly registered, even though it is symlinked to plugins dir
		verifyNoPluginErrors(t, pm)
		const pluginID = "test-app"
		assert.NotNil(t, pm.plugins[pluginID])
	})
}

func TestPluginManager_Installer(t *testing.T) {
	t.Run("Install plugin after manager init", func(t *testing.T) {
		pm := createManager(t, func(pm *PluginManager) {
		})

		err := pm.init()
		require.NoError(t, err)

		// mock installer
		i := &fakePluginInstaller{}
		pm.pluginInstaller = i

		// Set plugin location (we do this after manager Init() so that
		// it doesn't install the plugin automatically)
		pm.cfg.PluginsPath = "testdata/installer"

		pluginID := "test"
		pluginFolder := pm.cfg.PluginsPath + "/plugin"

		err = pm.Install(context.Background(), pluginID, "1.0.0")
		require.NoError(t, err)

		assert.Equal(t, 1, installer.installCount)
		assert.Equal(t, 0, installer.uninstallCount)

		// verify plugin manager has loaded core plugins successfully
		verifyNoPluginErrors(t, pm)
		verifyCorePluginCatalogue(t, pm)

		// verify plugin has been loaded successfully
		assert.NotNil(t, pm.Plugin(pluginID))
		if diff := cmp.Diff(&plugins.PluginBase{
			Type:  "datasource",
			Name:  "Test",
			State: "alpha",
			Id:    pluginID,
			Info: plugins.PluginInfo{
				Author: plugins.PluginInfoLink{
					Name: "Will Browne",
					URL:  "https://willbrowne.com",
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
			Signature:     plugins.SignatureValid,
			SignatureType: plugins.GrafanaType,
			SignatureOrg:  "Grafana Labs",
			SignedFiles:   plugins.PluginFiles{"plugin.json": {}},
			Dependencies: plugins.PluginDependencies{
				GrafanaVersion: "*",
				Plugins:        []plugins.PluginDependencyItem{},
			},
			Module:  "plugins/test/module",
			BaseUrl: "public/plugins/test",
		}, pm.Plugin(pluginID)); diff != "" {
			t.Errorf("result mismatch (-want +got) %s\n", diff)
		}

		assert.Len(t, pm.Routes(), 1)
		assert.Equal(t, pluginID, pm.Routes()[0].PluginID)
		assert.Equal(t, pluginFolder, pm.Routes()[0].Directory)

		t.Run("Won't install if already installed", func(t *testing.T) {
			err := pm.Install(context.Background(), pluginID, "1.0.0", plugins.InstallOpts{})
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

			assert.Nil(t, pm.Plugin(pluginID))
			assert.Len(t, pm.Routes(), 0)

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
		assert.NotNil(t, pm.Plugin(p))
		assert.Equal(t, plugins.Panel, pm.Plugin(p).Type)
	}

	for _, ds := range datasources {
		assert.NotNil(t, pm.Plugin(ds))
		assert.Equal(t, plugins.DataSource, pm.Plugin(ds).Type)
	}
}

func verifyBundledPlugins(t *testing.T, pm *PluginManager) {
	t.Helper()

	bundledPlugins := map[string]string{
		"input": "input-datasource",
	}

	for pluginID, pluginDir := range bundledPlugins {
		assert.NotNil(t, pm.plugins[pluginID])
		for _, route := range pm.Routes() {
			if pluginID == route.PluginID {
				assert.True(t, strings.HasPrefix(route.Directory, pm.cfg.BundledPluginsPath+"/"+pluginDir))
			}
		}
	}

	assert.NotNil(t, pm.Plugin("input"))
}

type fakePluginInstaller struct {
	installer.Installer

	installCount   int
	uninstallCount int
}

func (f *fakePluginInstaller) Install(ctx context.Context, pluginID, version, pluginsDir, pluginZipURL, pluginRepoURL string) error {
	f.installCount++
	return nil
}

func (f *fakePluginInstaller) Uninstall(ctx context.Context, pluginPath string) error {
	f.uninstallCount++
	return nil
}

func (f *fakePluginInstaller) GetUpdateInfo(pluginID, version, pluginRepoURL string) (installer.UpdateInfo, error) {
	return installer.UpdateInfo{}, nil
}

func createManager(t *testing.T, cbs ...func(*PluginManager)) *PluginManager {
	t.Helper()

	staticRootPath, err := filepath.Abs("../../../public/")
	require.NoError(t, err)

	cfg := &setting.Cfg{
		Raw:            ini.Empty(),
		Env:            setting.Prod,
		StaticRootPath: staticRootPath,
	}
	pm := newManager(cfg, nil, nil, &sqlstore.SQLStore{})

	for _, cb := range cbs {
		cb(pm)
	}

	return pm
}

// Backend plugin manager

const testPluginID = "test-plugin"

func TestManager(t *testing.T) {

	p := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID: testPluginID,
		},
	}

	newManagerScenario(t, true, func(t *testing.T, ctx *managerScenarioCtx) {
		t.Run("Managed plugin scenario", func(t *testing.T) {
			ctx.license.edition = "Open Source"
			ctx.license.hasLicense = false
			ctx.cfg.BuildVersion = "7.0.0"

			t.Run("Should be able to register plugin", func(t *testing.T) {
				err := ctx.manager.registerAndStart(context.Background(), testPluginID, ctx.factory)
				require.NoError(t, err)
				require.NotNil(t, ctx.plugin)
				require.Equal(t, testPluginID, ctx.plugin.pluginID)
				require.NotNil(t, ctx.plugin.logger)
				require.Equal(t, 1, ctx.plugin.startCount)
				require.True(t, ctx.manager.IsRegistered(testPluginID))

				t.Run("Should not be able to register an already registered plugin", func(t *testing.T) {
					err := ctx.manager.RegisterAndStart(context.Background(), testPluginID, ctx.factory)
					require.Equal(t, 1, ctx.plugin.startCount)
					require.Error(t, err)
				})

				t.Run("Should provide expected host environment variables", func(t *testing.T) {
					require.Len(t, ctx.env, 7)
					require.EqualValues(t, []string{
						"GF_VERSION=7.0.0",
						"GF_EDITION=Open Source",
						fmt.Sprintf("%s=true", awsds.AssumeRoleEnabledEnvVarKeyName),
						fmt.Sprintf("%s=keys,credentials", awsds.AllowedAuthProvidersEnvVarKeyName),
						"AZURE_CLOUD=AzureCloud",
						"AZURE_MANAGED_IDENTITY_CLIENT_ID=client-id",
						"AZURE_MANAGED_IDENTITY_ENABLED=true"},
						ctx.env)
				})

				t.Run("When manager runs should start and stop plugin", func(t *testing.T) {
					pCtx := context.Background()
					cCtx, cancel := context.WithCancel(pCtx)
					var wg sync.WaitGroup
					wg.Add(1)
					var runErr error
					go func() {
						runErr = ctx.manager.Run(cCtx)
						wg.Done()
					}()
					time.Sleep(time.Millisecond)
					cancel()
					wg.Wait()
					require.Equal(t, context.Canceled, runErr)
					require.Equal(t, 1, ctx.plugin.startCount)
					require.Equal(t, 1, ctx.plugin.stopCount)
				})

				t.Run("When manager runs should restart plugin process when killed", func(t *testing.T) {
					ctx.plugin.stopCount = 0
					ctx.plugin.startCount = 0
					pCtx := context.Background()
					cCtx, cancel := context.WithCancel(pCtx)
					var wgRun sync.WaitGroup
					wgRun.Add(1)
					var runErr error
					go func() {
						runErr = ctx.manager.Run(cCtx)
						wgRun.Done()
					}()

					time.Sleep(time.Millisecond)

					var wgKill sync.WaitGroup
					wgKill.Add(1)
					go func() {
						ctx.plugin.kill()
						for {
							if !ctx.plugin.Exited() {
								break
							}
						}
						cancel()
						wgKill.Done()
					}()
					wgKill.Wait()
					wgRun.Wait()
					require.Equal(t, context.Canceled, runErr)
					require.Equal(t, 1, ctx.plugin.stopCount)
					require.Equal(t, 1, ctx.plugin.startCount)
				})

				t.Run("Shouldn't be able to start managed plugin", func(t *testing.T) {
					err := ctx.manager.start(context.Background(), testPluginID)
					require.NotNil(t, err)
				})

				t.Run("Unimplemented handlers", func(t *testing.T) {
					t.Run("Collect metrics should return method not implemented error", func(t *testing.T) {
						_, err = ctx.manager.CollectMetrics(context.Background(), testPluginID)
						require.Equal(t, backendplugin.ErrMethodNotImplemented, err)
					})

					t.Run("Check health should return method not implemented error", func(t *testing.T) {
						_, err = ctx.manager.CheckHealth(context.Background(), backend.PluginContext{PluginID: testPluginID})
						require.Equal(t, backendplugin.ErrMethodNotImplemented, err)
					})

					t.Run("Call resource should return method not implemented error", func(t *testing.T) {
						req, err := http.NewRequest(http.MethodGet, "/test", bytes.NewReader([]byte{}))
						require.NoError(t, err)
						w := httptest.NewRecorder()
						err = ctx.manager.callResourceInternal(w, req, backend.PluginContext{PluginID: testPluginID})
						require.Equal(t, backendplugin.ErrMethodNotImplemented, err)
					})
				})

				t.Run("Implemented handlers", func(t *testing.T) {
					t.Run("Collect metrics should return expected result", func(t *testing.T) {
						ctx.plugin.CollectMetricsHandlerFunc = func(ctx context.Context) (*backend.CollectMetricsResult, error) {
							return &backend.CollectMetricsResult{
								PrometheusMetrics: []byte("hello"),
							}, nil
						}

						res, err := ctx.manager.CollectMetrics(context.Background(), testPluginID)
						require.NoError(t, err)
						require.NotNil(t, res)
						require.Equal(t, "hello", string(res.PrometheusMetrics))
					})

					t.Run("Check health should return expected result", func(t *testing.T) {
						json := []byte(`{
							"key": "value"
						}`)
						ctx.plugin.CheckHealthHandlerFunc = func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
							return &backend.CheckHealthResult{
								Status:      backend.HealthStatusOk,
								Message:     "All good",
								JSONDetails: json,
							}, nil
						}

						res, err := ctx.manager.CheckHealth(context.Background(), backend.PluginContext{PluginID: testPluginID})
						require.NoError(t, err)
						require.NotNil(t, res)
						require.Equal(t, backend.HealthStatusOk, res.Status)
						require.Equal(t, "All good", res.Message)
						require.Equal(t, json, res.JSONDetails)
					})

					t.Run("Call resource should return expected response", func(t *testing.T) {
						ctx.plugin.CallResourceHandlerFunc = func(ctx context.Context,
							req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
							return sender.Send(&backend.CallResourceResponse{
								Status: http.StatusOK,
							})
						}

						req, err := http.NewRequest(http.MethodGet, "/test", bytes.NewReader([]byte{}))
						require.NoError(t, err)
						w := httptest.NewRecorder()
						err = ctx.manager.callResourceInternal(w, req, backend.PluginContext{PluginID: testPluginID})
						require.NoError(t, err)
						require.Equal(t, http.StatusOK, w.Code)
					})
				})

				t.Run("Should be able to decommission a running plugin", func(t *testing.T) {
					require.True(t, ctx.manager.IsRegistered(testPluginID))

					err := ctx.manager.UnregisterAndStop(context.Background(), testPluginID)
					require.NoError(t, err)

					require.Equal(t, 2, ctx.plugin.stopCount)
					require.False(t, ctx.manager.IsRegistered(testPluginID))
					p := ctx.manager.plugins[testPluginID]
					require.Nil(t, p)

					err = ctx.manager.StartPlugin(context.Background(), testPluginID)
					require.Equal(t, backendplugin.ErrPluginNotRegistered, err)
				})
			})
		})
	})

	newManagerScenario(t, false, func(t *testing.T, ctx *managerScenarioCtx) {
		t.Run("Unmanaged plugin scenario", func(t *testing.T) {
			ctx.license.edition = "Open Source"
			ctx.license.hasLicense = false
			ctx.cfg.BuildVersion = "7.0.0"

			t.Run("Should be able to register plugin", func(t *testing.T) {
				err := ctx.manager.RegisterAndStart(context.Background(), testPluginID, ctx.factory)
				require.NoError(t, err)
				require.True(t, ctx.manager.IsRegistered(testPluginID))
				require.False(t, ctx.plugin.managed)

				t.Run("When manager runs should not start plugin", func(t *testing.T) {
					pCtx := context.Background()
					cCtx, cancel := context.WithCancel(pCtx)
					var wg sync.WaitGroup
					wg.Add(1)
					var runErr error
					go func() {
						runErr = ctx.manager.Run(cCtx)
						wg.Done()
					}()
					go func() {
						cancel()
					}()
					wg.Wait()
					require.Equal(t, context.Canceled, runErr)
					require.Equal(t, 0, ctx.plugin.startCount)
					require.Equal(t, 1, ctx.plugin.stopCount)
					require.True(t, ctx.plugin.Exited())
				})

				t.Run("Should be able to start unmanaged plugin and be restarted when process is killed", func(t *testing.T) {
					pCtx := context.Background()
					cCtx, cancel := context.WithCancel(pCtx)
					defer cancel()
					err := ctx.manager.StartPlugin(cCtx, testPluginID)
					require.Nil(t, err)
					require.Equal(t, 1, ctx.plugin.startCount)

					var wg sync.WaitGroup
					wg.Add(1)
					go func() {
						ctx.plugin.kill()
						for {
							if !ctx.plugin.Exited() {
								break
							}
						}
						wg.Done()
					}()
					wg.Wait()
					require.Equal(t, 2, ctx.plugin.startCount)
				})
			})
		})
	})

	newManagerScenario(t, true, func(t *testing.T, ctx *managerScenarioCtx) {
		t.Run("Plugin registration scenario when Grafana is licensed", func(t *testing.T) {
			ctx.license.edition = "Enterprise"
			ctx.license.hasLicense = true
			ctx.license.tokenRaw = "testtoken"
			ctx.cfg.BuildVersion = "7.0.0"
			ctx.cfg.EnterpriseLicensePath = "/license.txt"

			err := ctx.manager.RegisterAndStart(context.Background(), testPluginID, ctx.factory)
			require.NoError(t, err)

			t.Run("Should provide expected host environment variables", func(t *testing.T) {
				require.Len(t, ctx.env, 9)
				require.EqualValues(t, []string{
					"GF_VERSION=7.0.0",
					"GF_EDITION=Enterprise",
					"GF_ENTERPRISE_LICENSE_PATH=/license.txt",
					"GF_ENTERPRISE_LICENSE_TEXT=testtoken",
					fmt.Sprintf("%s=true", awsds.AssumeRoleEnabledEnvVarKeyName),
					fmt.Sprintf("%s=keys,credentials", awsds.AllowedAuthProvidersEnvVarKeyName),
					"AZURE_CLOUD=AzureCloud",
					"AZURE_MANAGED_IDENTITY_CLIENT_ID=client-id",
					"AZURE_MANAGED_IDENTITY_ENABLED=true"},
					ctx.env)
			})
		})
	})
}

type managerScenarioCtx struct {
	cfg     *setting.Cfg
	license *testLicensingService
	manager *PluginManager
	factory backendplugin.PluginFactoryFunc
	plugin  *testPlugin
	env     []string
}

func newManagerScenario(t *testing.T, managed bool, fn func(t *testing.T, ctx *managerScenarioCtx)) {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.AWSAllowedAuthProviders = []string{"keys", "credentials"}
	cfg.AWSAssumeRoleEnabled = true

	cfg.Azure.ManagedIdentityEnabled = true
	cfg.Azure.Cloud = "AzureCloud"
	cfg.Azure.ManagedIdentityClientId = "client-id"

	license := &testLicensingService{}
	validator := &testPluginRequestValidator{}
	ctx := &managerScenarioCtx{
		cfg:     cfg,
		license: license,
		manager: &PluginManager{
			cfg:              cfg,
			license:          license,
			requestValidator: validator,
			log:              log.New("test"),
			plugins:          map[string]*plugins.Plugin{},
		},
	}

	ctx.factory = func(pluginID string, logger log.Logger, env []string) (backendplugin.Plugin, error) {
		ctx.plugin = &testPlugin{
			pluginID: pluginID,
			logger:   logger,
			managed:  managed,
		}
		ctx.env = env

		return ctx.plugin, nil
	}

	fn(t, ctx)
}

func verifyNoPluginErrors(t *testing.T, pm *PluginManager) {
	for _, plugin := range pm.plugins {
		assert.Nil(t, plugin.SignatureError)
	}
}

type testPlugin struct {
	pluginID       string
	logger         log.Logger
	startCount     int
	stopCount      int
	managed        bool
	exited         bool
	decommissioned bool
	backend.CollectMetricsHandlerFunc
	backend.CheckHealthHandlerFunc
	backend.QueryDataHandlerFunc
	backend.CallResourceHandlerFunc
	mutex sync.RWMutex
}

func (tp *testPlugin) PluginID() string {
	return tp.pluginID
}

func (tp *testPlugin) Logger() log.Logger {
	return tp.logger
}

func (tp *testPlugin) Start(ctx context.Context) error {
	tp.mutex.Lock()
	defer tp.mutex.Unlock()
	tp.exited = false
	tp.startCount++
	return nil
}

func (tp *testPlugin) Stop(ctx context.Context) error {
	tp.mutex.Lock()
	defer tp.mutex.Unlock()
	tp.stopCount++
	tp.exited = true
	return nil
}

func (tp *testPlugin) IsManaged() bool {
	return tp.managed
}

func (tp *testPlugin) Exited() bool {
	tp.mutex.RLock()
	defer tp.mutex.RUnlock()
	return tp.exited
}

func (tp *testPlugin) Decommission() error {
	tp.mutex.Lock()
	defer tp.mutex.Unlock()

	tp.decommissioned = true

	return nil
}

func (tp *testPlugin) IsDecommissioned() bool {
	tp.mutex.RLock()
	defer tp.mutex.RUnlock()
	return tp.decommissioned
}

func (tp *testPlugin) kill() {
	tp.mutex.Lock()
	defer tp.mutex.Unlock()
	tp.exited = true
}

func (tp *testPlugin) CollectMetrics(ctx context.Context) (*backend.CollectMetricsResult, error) {
	if tp.CollectMetricsHandlerFunc != nil {
		return tp.CollectMetricsHandlerFunc(ctx)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *testPlugin) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if tp.CheckHealthHandlerFunc != nil {
		return tp.CheckHealthHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *testPlugin) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if tp.QueryDataHandlerFunc != nil {
		return tp.QueryDataHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *testPlugin) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if tp.CallResourceHandlerFunc != nil {
		return tp.CallResourceHandlerFunc(ctx, req, sender)
	}

	return backendplugin.ErrMethodNotImplemented
}

func (tp *testPlugin) SubscribeStream(ctx context.Context, request *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *testPlugin) PublishStream(ctx context.Context, request *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *testPlugin) RunStream(ctx context.Context, request *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return backendplugin.ErrMethodNotImplemented
}

type testLicensingService struct {
	edition    string
	hasLicense bool
	tokenRaw   string
}

func (t *testLicensingService) HasLicense() bool {
	return t.hasLicense
}

func (t *testLicensingService) Expiry() int64 {
	return 0
}

func (t *testLicensingService) Edition() string {
	return t.edition
}

func (t *testLicensingService) StateInfo() string {
	return ""
}

func (t *testLicensingService) ContentDeliveryPrefix() string {
	return ""
}

func (t *testLicensingService) LicenseURL(user *models.SignedInUser) string {
	return ""
}

func (t *testLicensingService) HasValidLicense() bool {
	return false
}

func (t *testLicensingService) Environment() map[string]string {
	return map[string]string{"GF_ENTERPRISE_LICENSE_TEXT": t.tokenRaw}
}

type testPluginRequestValidator struct{}

func (t *testPluginRequestValidator) Validate(string, *http.Request) error {
	return nil
}
