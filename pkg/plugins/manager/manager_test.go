package manager

import (
	"archive/zip"
	"context"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
)

const (
	testPluginID = "test-plugin"
)

func TestPluginManager_Init(t *testing.T) {
	t.Run("Plugin sources are loaded in order", func(t *testing.T) {
		loader := &fakeLoader{}
		pm := New(&plugins.Cfg{}, newFakePluginRegistry(), []PluginSource{
			{Class: plugins.Bundled, Paths: []string{"path1"}},
			{Class: plugins.Core, Paths: []string{"path2"}},
			{Class: plugins.External, Paths: []string{"path3"}},
		}, loader, &fakePluginRepo{}, &fakeFsManager{})

		err := pm.Init()
		require.NoError(t, err)
		require.Equal(t, []string{"path1", "path2", "path3"}, loader.loadedPaths)
	})
}

func TestPluginManager_loadPlugins(t *testing.T) {
	t.Run("Managed backend plugin", func(t *testing.T) {
		p, pc := createPlugin(t, testPluginID, plugins.External, true, func(p *plugins.Plugin) {
			p.Backend = true
		})

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins(context.Background(), plugins.External, "test/path")
		require.NoError(t, err)

		assert.Equal(t, 1, pc.startCount)
		assert.Equal(t, 0, pc.stopCount)
		assert.False(t, pc.exited)
		assert.False(t, pc.decommissioned)

		testPlugin, exists := pm.Plugin(context.Background(), testPluginID)
		assert.True(t, exists)
		assert.Equal(t, p.ToDTO(), testPlugin)
		assert.Len(t, pm.Plugins(context.Background()), 1)

		verifyNoPluginErrors(t, pm)
	})

	t.Run("Unmanaged backend plugin", func(t *testing.T) {
		p, pc := createPlugin(t, testPluginID, plugins.External, false, func(p *plugins.Plugin) {
			p.Backend = true
		})

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins(context.Background(), plugins.External, "test/path")
		require.NoError(t, err)

		assert.Equal(t, 0, pc.startCount)
		assert.Equal(t, 0, pc.stopCount)
		assert.False(t, pc.exited)
		assert.False(t, pc.decommissioned)

		testPlugin, exists := pm.Plugin(context.Background(), testPluginID)
		assert.True(t, exists)
		assert.Equal(t, p.ToDTO(), testPlugin)
		assert.Len(t, pm.Plugins(context.Background()), 1)

		verifyNoPluginErrors(t, pm)
	})

	t.Run("Managed non-backend plugin", func(t *testing.T) {
		p, pc := createPlugin(t, testPluginID, plugins.External, false, func(p *plugins.Plugin) {
			p.Backend = true
		})

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins(context.Background(), plugins.External, "test/path")
		require.NoError(t, err)

		assert.Equal(t, 0, pc.startCount)
		assert.Equal(t, 0, pc.stopCount)
		assert.False(t, pc.exited)
		assert.False(t, pc.decommissioned)

		testPlugin, exists := pm.Plugin(context.Background(), testPluginID)
		assert.True(t, exists)
		assert.Equal(t, p.ToDTO(), testPlugin)
		assert.Len(t, pm.Plugins(context.Background()), 1)

		verifyNoPluginErrors(t, pm)
	})

	t.Run("Unmanaged non-backend plugin", func(t *testing.T) {
		p, pc := createPlugin(t, testPluginID, plugins.External, false)

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins(context.Background(), plugins.External, "test/path")
		require.NoError(t, err)

		assert.Equal(t, 0, pc.startCount)
		assert.Equal(t, 0, pc.stopCount)
		assert.False(t, pc.exited)
		assert.False(t, pc.decommissioned)

		testPlugin, exists := pm.Plugin(context.Background(), testPluginID)
		assert.True(t, exists)
		assert.Equal(t, p.ToDTO(), testPlugin)
		assert.Len(t, pm.Plugins(context.Background()), 1)

		verifyNoPluginErrors(t, pm)
	})
}

func TestPluginManager_Installer(t *testing.T) {
	t.Run("Add new plugin", func(t *testing.T) {
		testDir, err := os.CreateTemp(os.TempDir(), "plugin-manager-test-*")
		require.NoError(t, err)
		t.Cleanup(func() {
			err := os.RemoveAll(testDir.Name())
			assert.NoError(t, err)
		})

		p, pc := createPlugin(t, testPluginID, plugins.External, true, func(p *plugins.Plugin) {
			p.PluginDir = filepath.Join(testDir.Name(), p.ID)
			p.Backend = true
		})

		l := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}
		fsm := &fakeFsManager{}

		repository := &fakePluginRepo{}
		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = testDir.Name()
			pm.pluginLoader = l
			pm.pluginStorage = fsm
			pm.pluginRepo = repository
		})

		err = pm.Add(context.Background(), testPluginID, "1.0.0", plugins.CompatOpts{})
		require.NoError(t, err)

		assert.Equal(t, 1, repository.downloadCount)

		verifyNoPluginErrors(t, pm)

		assert.Len(t, pm.Routes(), 1)
		assert.Equal(t, p.ID, pm.Routes()[0].PluginID)
		assert.Equal(t, p.PluginDir, pm.Routes()[0].Directory)

		assert.Equal(t, 1, repository.downloadCount)
		assert.Equal(t, 0, fsm.removed)
		assert.Equal(t, 1, fsm.added)

		assert.Equal(t, 1, pc.startCount)
		assert.Equal(t, 0, pc.stopCount)
		assert.False(t, pc.exited)
		assert.False(t, pc.decommissioned)

		testPlugin, exists := pm.Plugin(context.Background(), testPluginID)
		assert.True(t, exists)
		assert.Equal(t, p.ToDTO(), testPlugin)
		assert.Len(t, pm.Plugins(context.Background()), 1)

		t.Run("Won't install if already installed", func(t *testing.T) {
			err := pm.Add(context.Background(), testPluginID, "1.0.0", plugins.CompatOpts{})
			assert.Equal(t, plugins.DuplicateError{
				PluginID:          p.ID,
				ExistingPluginDir: p.PluginDir,
			}, err)
		})

		t.Run("Update option is the same as installed version", func(t *testing.T) {
			repository.downloadOptionsHandler = func(_ context.Context, _, _ string, _ repo.CompatOpts) (*repo.PluginDownloadOptions, error) {
				return &repo.PluginDownloadOptions{
					Version: p.Info.Version,
				}, nil
			}

			err = pm.Add(context.Background(), p.ID, "", plugins.CompatOpts{})
			require.ErrorIs(t, err, plugins.DuplicateError{
				PluginID:          p.ID,
				ExistingPluginDir: p.PluginDir,
			})

			assert.Equal(t, 1, repository.downloadCount)
			assert.Equal(t, 0, fsm.removed)
			assert.Equal(t, 1, fsm.added)
			assert.Equal(t, 1, pc.startCount)
			assert.Equal(t, 0, pc.stopCount)
			assert.False(t, pc.exited)
			assert.False(t, pc.decommissioned)

			testPlugin, exists = pm.Plugin(context.Background(), p.ID)
			assert.True(t, exists)
			assert.Equal(t, p.ToDTO(), testPlugin)
			assert.Len(t, pm.Plugins(context.Background()), 1)
		})

		t.Run("Update existing plugin", func(t *testing.T) {
			p, pc := createPlugin(t, testPluginID, plugins.External, true, func(p *plugins.Plugin) {
				p.Backend = true
				p.PluginDir = filepath.Join(testDir.Name(), p.ID)
			})

			l := &fakeLoader{
				mockedLoadedPlugins: []*plugins.Plugin{p},
			}
			pm.pluginLoader = l

			repository.downloadOptionsHandler = func(_ context.Context, _, _ string, _ repo.CompatOpts) (*repo.PluginDownloadOptions, error) {
				return &repo.PluginDownloadOptions{
					Version: "1.2.0",
				}, nil
			}

			err = pm.Add(context.Background(), testPluginID, "1.2.0", plugins.CompatOpts{})
			assert.NoError(t, err)

			assert.Equal(t, 2, repository.downloadCount)
			assert.Equal(t, 1, fsm.removed)
			assert.Equal(t, 2, fsm.added)
			assert.Equal(t, 1, pc.startCount)
			assert.Equal(t, 0, pc.stopCount)
			assert.False(t, pc.exited)
			assert.False(t, pc.decommissioned)

			testPlugin, exists := pm.Plugin(context.Background(), testPluginID)
			assert.True(t, exists)
			assert.Equal(t, p.ToDTO(), testPlugin)
			assert.Len(t, pm.Plugins(context.Background()), 1)
		})

		t.Run("Uninstall existing plugin", func(t *testing.T) {
			err := pm.Remove(context.Background(), p.ID)
			require.NoError(t, err)

			assert.Equal(t, 2, repository.downloadCount)

			p, exists := pm.Plugin(context.Background(), p.ID)
			assert.False(t, exists)
			assert.Equal(t, plugins.PluginDTO{}, p)
			assert.Len(t, pm.Routes(), 0)

			t.Run("Won't uninstall if not installed", func(t *testing.T) {
				err := pm.Remove(context.Background(), p.ID)
				require.Equal(t, plugins.ErrPluginNotInstalled, err)
			})
		})
	})

	t.Run("Can't update core plugin", func(t *testing.T) {
		p, pc := createPlugin(t, testPluginID, plugins.Core, true, func(p *plugins.Plugin) {
			p.Backend = true
		})

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins(context.Background(), plugins.Core, "test/path")
		require.NoError(t, err)

		assert.Equal(t, 0, pc.startCount)
		assert.Equal(t, 0, pc.stopCount)
		assert.False(t, pc.exited)
		assert.False(t, pc.decommissioned)

		testPlugin, exists := pm.Plugin(context.Background(), testPluginID)
		assert.True(t, exists)
		assert.Equal(t, p.ToDTO(), testPlugin)
		assert.Len(t, pm.Plugins(context.Background()), 1)

		verifyNoPluginErrors(t, pm)

		err = pm.Add(context.Background(), testPluginID, "1.0.0", plugins.CompatOpts{})
		assert.Equal(t, plugins.ErrInstallCorePlugin, err)

		t.Run("Can't uninstall core plugin", func(t *testing.T) {
			err := pm.Remove(context.Background(), p.ID)
			require.Equal(t, plugins.ErrUninstallCorePlugin, err)
		})
	})

	t.Run("Can't update bundled plugin", func(t *testing.T) {
		p, pc := createPlugin(t, testPluginID, plugins.Bundled, true, func(p *plugins.Plugin) {
			p.Backend = true
		})

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins(context.Background(), plugins.Bundled, "test/path")
		require.NoError(t, err)

		assert.Equal(t, 1, pc.startCount)
		assert.Equal(t, 0, pc.stopCount)
		assert.False(t, pc.exited)
		assert.False(t, pc.decommissioned)

		testPlugin, exists := pm.Plugin(context.Background(), testPluginID)
		assert.True(t, exists)
		assert.Equal(t, p.ToDTO(), testPlugin)
		assert.Len(t, pm.Plugins(context.Background()), 1)

		verifyNoPluginErrors(t, pm)

		err = pm.Add(context.Background(), testPluginID, "1.0.0", plugins.CompatOpts{})
		assert.Equal(t, plugins.ErrInstallCorePlugin, err)

		t.Run("Can't uninstall bundled plugin", func(t *testing.T) {
			err := pm.Remove(context.Background(), p.ID)
			require.Equal(t, plugins.ErrUninstallCorePlugin, err)
		})
	})
}

func TestPluginManager_registeredPlugins(t *testing.T) {
	t.Run("Decommissioned plugins are included in registeredPlugins", func(t *testing.T) {
		decommissionedPlugin, _ := createPlugin(t, testPluginID, plugins.External, true, func(p *plugins.Plugin) {
			p.Backend = true
			err := p.Decommission()
			require.NoError(t, err)
		})

		pm := New(&plugins.Cfg{}, &fakePluginRegistry{
			store: map[string]*plugins.Plugin{
				testPluginID: decommissionedPlugin,
				"test-app":   {},
			},
		}, []PluginSource{}, &fakeLoader{}, &fakePluginRepo{}, &fakeFsManager{})

		require.True(t, decommissionedPlugin.IsDecommissioned())

		rps := pm.registeredPlugins(context.Background())
		require.Equal(t, 2, len(rps))
		require.NotNil(t, rps[testPluginID])
		require.NotNil(t, rps["test-app"])
	})
}

func TestPluginManager_lifecycle_managed(t *testing.T) {
	newScenario(t, true, func(t *testing.T, ctx *managerScenarioCtx) {
		t.Run("Managed plugin scenario", func(t *testing.T) {
			t.Run("Should be able to register plugin", func(t *testing.T) {
				err := ctx.manager.registerAndStart(context.Background(), ctx.plugin)
				require.NoError(t, err)
				require.NotNil(t, ctx.plugin)
				require.Equal(t, testPluginID, ctx.plugin.ID)
				require.Equal(t, 1, ctx.pluginClient.startCount)
				testPlugin, exists := ctx.manager.Plugin(context.Background(), testPluginID)
				require.True(t, exists)
				require.NotNil(t, testPlugin)

				t.Run("Should not be able to register an already registered plugin", func(t *testing.T) {
					err := ctx.manager.registerAndStart(context.Background(), ctx.plugin)
					require.Error(t, err)
					require.Equal(t, 1, ctx.pluginClient.startCount)
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
					require.Equal(t, 1, ctx.pluginClient.startCount)
					require.Equal(t, 1, ctx.pluginClient.stopCount)
				})

				t.Run("When manager runs should restart plugin process when killed", func(t *testing.T) {
					ctx.pluginClient.stopCount = 0
					ctx.pluginClient.startCount = 0
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
						ctx.pluginClient.kill()
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
					require.Equal(t, 1, ctx.pluginClient.stopCount)
					require.Equal(t, 1, ctx.pluginClient.startCount)
				})

				t.Run("Unimplemented handlers", func(t *testing.T) {
					t.Run("Collect metrics should return method not implemented error", func(t *testing.T) {
						_, err = ctx.manager.CollectMetrics(context.Background(), &backend.CollectMetricsRequest{PluginContext: backend.PluginContext{PluginID: testPluginID}})
						require.Equal(t, backendplugin.ErrMethodNotImplemented, err)
					})

					t.Run("Check health should return method not implemented error", func(t *testing.T) {
						_, err = ctx.manager.CheckHealth(context.Background(), &backend.CheckHealthRequest{PluginContext: backend.PluginContext{PluginID: testPluginID}})
						require.Equal(t, backendplugin.ErrMethodNotImplemented, err)
					})
				})

				t.Run("Implemented handlers", func(t *testing.T) {
					t.Run("Collect metrics should return expected result", func(t *testing.T) {
						ctx.pluginClient.CollectMetricsHandlerFunc = func(_ context.Context, _ *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
							return &backend.CollectMetricsResult{
								PrometheusMetrics: []byte("hello"),
							}, nil
						}

						res, err := ctx.manager.CollectMetrics(context.Background(), &backend.CollectMetricsRequest{PluginContext: backend.PluginContext{PluginID: testPluginID}})
						require.NoError(t, err)
						require.NotNil(t, res)
						require.Equal(t, "hello", string(res.PrometheusMetrics))
					})

					t.Run("Check health should return expected result", func(t *testing.T) {
						json := []byte(`{
							"key": "value"
						}`)
						ctx.pluginClient.CheckHealthHandlerFunc = func(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
							return &backend.CheckHealthResult{
								Status:      backend.HealthStatusOk,
								Message:     "All good",
								JSONDetails: json,
							}, nil
						}

						res, err := ctx.manager.CheckHealth(context.Background(), &backend.CheckHealthRequest{PluginContext: backend.PluginContext{PluginID: testPluginID}})
						require.NoError(t, err)
						require.NotNil(t, res)
						require.Equal(t, backend.HealthStatusOk, res.Status)
						require.Equal(t, "All good", res.Message)
						require.Equal(t, json, res.JSONDetails)
					})

					t.Run("Call resource should return expected response", func(t *testing.T) {
						ctx.pluginClient.CallResourceHandlerFunc = func(ctx context.Context,
							req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
							return sender.Send(&backend.CallResourceResponse{
								Status: http.StatusOK,
							})
						}

						sender := &fakeSender{}
						err = ctx.manager.CallResource(context.Background(), &backend.CallResourceRequest{PluginContext: backend.PluginContext{PluginID: testPluginID}}, sender)
						require.NoError(t, err)
						require.NotNil(t, sender.resp)
						require.Equal(t, http.StatusOK, sender.resp.Status)
					})
				})
			})
		})
	})

	newScenario(t, true, func(t *testing.T, ctx *managerScenarioCtx) {
		t.Run("Backend core plugin is registered but not started", func(t *testing.T) {
			ctx.plugin.Class = plugins.Core
			err := ctx.manager.registerAndStart(context.Background(), ctx.plugin)
			require.NoError(t, err)
			require.NotNil(t, ctx.plugin)
			require.Equal(t, testPluginID, ctx.plugin.ID)
			require.Equal(t, 0, ctx.pluginClient.startCount)
			testPlugin, exists := ctx.manager.Plugin(context.Background(), testPluginID)
			assert.True(t, exists)
			require.NotNil(t, testPlugin)
		})
	})
}

func TestPluginManager_lifecycle_unmanaged(t *testing.T) {
	newScenario(t, false, func(t *testing.T, ctx *managerScenarioCtx) {
		t.Run("Unmanaged plugin scenario", func(t *testing.T) {
			t.Run("Should be able to register plugin", func(t *testing.T) {
				err := ctx.manager.registerAndStart(context.Background(), ctx.plugin)
				require.NoError(t, err)
				p, exists := ctx.manager.Plugin(context.Background(), testPluginID)
				require.True(t, exists)
				require.NotNil(t, p)
				require.False(t, ctx.pluginClient.managed)

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
					require.Equal(t, 0, ctx.pluginClient.startCount)
					require.Equal(t, 1, ctx.pluginClient.stopCount)
					require.True(t, ctx.plugin.Exited())
				})

				t.Run("Should be not be able to start unmanaged plugin", func(t *testing.T) {
					pCtx := context.Background()
					cCtx, cancel := context.WithCancel(pCtx)
					defer cancel()
					err := ctx.manager.start(cCtx, ctx.plugin)
					require.Nil(t, err)
					require.Equal(t, 0, ctx.pluginClient.startCount)
					require.True(t, ctx.plugin.Exited())
				})
			})
		})
	})
}

func createPlugin(t *testing.T, pluginID string, class plugins.Class, managed bool,
	cbs ...func(*plugins.Plugin)) (*plugins.Plugin, *fakePluginClient) {
	t.Helper()

	p := &plugins.Plugin{
		Class: class,
		JSONData: plugins.JSONData{
			ID:   pluginID,
			Type: plugins.DataSource,
			Info: plugins.Info{
				Version: "1.0.0",
			},
		},
	}

	logger := log.NewNopLogger()

	p.SetLogger(logger)

	pc := &fakePluginClient{
		pluginID: pluginID,
		logger:   logger,
		managed:  managed,
	}

	p.RegisterClient(pc)

	for _, cb := range cbs {
		cb(p)
	}

	return p, pc
}

func createManager(t *testing.T, cbs ...func(*PluginManager)) *PluginManager {
	t.Helper()

	cfg := &plugins.Cfg{
		DevMode: false,
	}

	pm := New(cfg, newFakePluginRegistry(), nil, &fakeLoader{}, &fakePluginRepo{}, &fakeFsManager{})

	for _, cb := range cbs {
		cb(pm)
	}

	return pm
}

type managerScenarioCtx struct {
	manager      *PluginManager
	plugin       *plugins.Plugin
	pluginClient *fakePluginClient
}

func newScenario(t *testing.T, managed bool, fn func(t *testing.T, ctx *managerScenarioCtx)) {
	t.Helper()
	cfg := &plugins.Cfg{}
	cfg.AWSAllowedAuthProviders = []string{"keys", "credentials"}
	cfg.AWSAssumeRoleEnabled = true
	cfg.Azure = &azsettings.AzureSettings{
		ManagedIdentityEnabled:  true,
		Cloud:                   "AzureCloud",
		ManagedIdentityClientId: "client-id",
	}

	loader := &fakeLoader{}
	manager := New(cfg, registry.NewInMemory(), nil, loader, &fakePluginRepo{}, &fakeFsManager{})
	manager.pluginLoader = loader
	ctx := &managerScenarioCtx{
		manager: manager,
	}

	ctx.plugin, ctx.pluginClient = createPlugin(t, testPluginID, plugins.External, managed, func(p *plugins.Plugin) {
		p.Backend = true
	})

	fn(t, ctx)
}

func verifyNoPluginErrors(t *testing.T, pm *PluginManager) {
	for _, plugin := range pm.Plugins(context.Background()) {
		assert.Nil(t, plugin.SignatureError)
	}
}

type fakePluginRepo struct {
	repo.Service

	downloadOptionsHandler func(_ context.Context, _, _ string, _ repo.CompatOpts) (*repo.PluginDownloadOptions, error)

	downloadOptionsCount int
	downloadCount        int
}

func (pr *fakePluginRepo) GetPluginArchive(_ context.Context, _, _ string, _ repo.CompatOpts) (*repo.PluginArchive, error) {
	pr.downloadCount++
	return &repo.PluginArchive{}, nil
}

// DownloadWithURL downloads the requested plugin from the specified URL.
func (pr *fakePluginRepo) GetPluginArchiveByURL(_ context.Context, _ string, _ repo.CompatOpts) (*repo.PluginArchive, error) {
	pr.downloadCount++
	return &repo.PluginArchive{}, nil
}

// GetDownloadOptions provides information for downloading the requested plugin.
func (pr *fakePluginRepo) GetPluginDownloadOptions(ctx context.Context, pluginID, version string, opts repo.CompatOpts) (*repo.PluginDownloadOptions, error) {
	pr.downloadOptionsCount++
	if pr.downloadOptionsHandler != nil {
		return pr.downloadOptionsHandler(ctx, pluginID, version, opts)
	}
	return &repo.PluginDownloadOptions{}, nil
}

type fakeLoader struct {
	mockedLoadedPlugins []*plugins.Plugin

	loadedPaths []string
}

func (l *fakeLoader) Load(_ context.Context, _ plugins.Class, paths []string, _ map[string]struct{}) ([]*plugins.Plugin, error) {
	l.loadedPaths = append(l.loadedPaths, paths...)

	return l.mockedLoadedPlugins, nil
}

type fakePluginClient struct {
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

	backendplugin.Plugin
}

func (pc *fakePluginClient) PluginID() string {
	return pc.pluginID
}

func (pc *fakePluginClient) Logger() log.Logger {
	return pc.logger
}

func (pc *fakePluginClient) Start(_ context.Context) error {
	pc.mutex.Lock()
	defer pc.mutex.Unlock()
	pc.exited = false
	pc.startCount++
	return nil
}

func (pc *fakePluginClient) Stop(_ context.Context) error {
	pc.mutex.Lock()
	defer pc.mutex.Unlock()
	pc.stopCount++
	pc.exited = true
	return nil
}

func (pc *fakePluginClient) IsManaged() bool {
	return pc.managed
}

func (pc *fakePluginClient) Exited() bool {
	pc.mutex.RLock()
	defer pc.mutex.RUnlock()
	return pc.exited
}

func (pc *fakePluginClient) Decommission() error {
	pc.mutex.Lock()
	defer pc.mutex.Unlock()

	pc.decommissioned = true

	return nil
}

func (pc *fakePluginClient) IsDecommissioned() bool {
	pc.mutex.RLock()
	defer pc.mutex.RUnlock()
	return pc.decommissioned
}

func (pc *fakePluginClient) kill() {
	pc.mutex.Lock()
	defer pc.mutex.Unlock()
	pc.exited = true
}

func (pc *fakePluginClient) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if pc.CollectMetricsHandlerFunc != nil {
		return pc.CollectMetricsHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *fakePluginClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if pc.CheckHealthHandlerFunc != nil {
		return pc.CheckHealthHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *fakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if pc.QueryDataHandlerFunc != nil {
		return pc.QueryDataHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *fakePluginClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if pc.CallResourceHandlerFunc != nil {
		return pc.CallResourceHandlerFunc(ctx, req, sender)
	}

	return backendplugin.ErrMethodNotImplemented
}

func (pc *fakePluginClient) SubscribeStream(_ context.Context, _ *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *fakePluginClient) PublishStream(_ context.Context, _ *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (pc *fakePluginClient) RunStream(_ context.Context, _ *backend.RunStreamRequest, _ *backend.StreamSender) error {
	return backendplugin.ErrMethodNotImplemented
}

type fakeSender struct {
	resp *backend.CallResourceResponse
}

func (s *fakeSender) Send(crr *backend.CallResourceResponse) error {
	s.resp = crr

	return nil
}

type fakePluginRegistry struct {
	store map[string]*plugins.Plugin
}

func newFakePluginRegistry() *fakePluginRegistry {
	return &fakePluginRegistry{
		store: make(map[string]*plugins.Plugin),
	}
}

func (f *fakePluginRegistry) Plugin(_ context.Context, id string) (*plugins.Plugin, bool) {
	p, exists := f.store[id]
	return p, exists
}

func (f *fakePluginRegistry) Plugins(_ context.Context) []*plugins.Plugin {
	var res []*plugins.Plugin

	for _, p := range f.store {
		res = append(res, p)
	}

	return res
}

func (f *fakePluginRegistry) Add(_ context.Context, p *plugins.Plugin) error {
	f.store[p.ID] = p
	return nil
}

func (f *fakePluginRegistry) Remove(_ context.Context, id string) error {
	delete(f.store, id)
	return nil
}

type fakeFsManager struct {
	storage.Manager

	added   int
	removed int
}

func (fsm *fakeFsManager) Add(_ context.Context, _ string, _ *zip.ReadCloser) (*storage.ExtractedPluginArchive, error) {
	fsm.added++
	return &storage.ExtractedPluginArchive{}, nil
}

func (fsm *fakeFsManager) Remove(_ context.Context, _ string) error {
	fsm.removed++
	return nil
}
