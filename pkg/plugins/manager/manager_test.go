package manager

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

const (
	testPluginID = "test-plugin"
)

func TestPluginManager_init(t *testing.T) {
	t.Run("Plugin folder will be created if not exists", func(t *testing.T) {
		testDir := "plugin-test-dir"

		exists, err := fs.Exists(testDir)
		require.NoError(t, err)
		assert.False(t, exists)

		pm := createManager(t, func(pm *PluginManager) {
			pm.cfg.PluginsPath = testDir
		})

		err = pm.init()
		require.NoError(t, err)

		exists, err = fs.Exists(testDir)
		require.NoError(t, err)
		assert.True(t, exists)

		t.Cleanup(func() {
			err = os.Remove(testDir)
			require.NoError(t, err)
		})
	})
}

func TestPluginManager_loadPlugins(t *testing.T) {
	t.Run("Managed backend plugin", func(t *testing.T) {
		p, pc := createPlugin(testPluginID, "", plugins.External, true, true)

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins("test/path")
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
		p, pc := createPlugin(testPluginID, "", plugins.External, false, true)

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins("test/path")
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
		p, pc := createPlugin(testPluginID, "", plugins.External, false, true)

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins("test/path")
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
		p, pc := createPlugin(testPluginID, "", plugins.External, false, false)

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins("test/path")
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
	t.Run("Install", func(t *testing.T) {
		p, pc := createPlugin(testPluginID, "1.0.0", plugins.External, true, true)

		l := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		i := &fakePluginInstaller{}
		pm := createManager(t, func(pm *PluginManager) {
			pm.pluginInstaller = i
			pm.pluginLoader = l
		})

		err := pm.Add(context.Background(), testPluginID, "1.0.0", plugins.AddOpts{})
		require.NoError(t, err)

		assert.Equal(t, 1, i.installCount)
		assert.Equal(t, 0, i.uninstallCount)

		verifyNoPluginErrors(t, pm)

		assert.Len(t, pm.Routes(), 1)
		assert.Equal(t, p.ID, pm.Routes()[0].PluginID)
		assert.Equal(t, p.PluginDir, pm.Routes()[0].Directory)

		assert.Equal(t, 1, pc.startCount)
		assert.Equal(t, 0, pc.stopCount)
		assert.False(t, pc.exited)
		assert.False(t, pc.decommissioned)

		testPlugin, exists := pm.Plugin(context.Background(), testPluginID)
		assert.True(t, exists)
		assert.Equal(t, p.ToDTO(), testPlugin)
		assert.Len(t, pm.Plugins(context.Background()), 1)

		t.Run("Won't install if already installed", func(t *testing.T) {
			err := pm.Add(context.Background(), testPluginID, "1.0.0", plugins.AddOpts{})
			assert.Equal(t, plugins.DuplicateError{
				PluginID:          p.ID,
				ExistingPluginDir: p.PluginDir,
			}, err)
		})

		t.Run("Update", func(t *testing.T) {
			p, pc := createPlugin(testPluginID, "1.2.0", plugins.External, true, true)

			l := &fakeLoader{
				mockedLoadedPlugins: []*plugins.Plugin{p},
			}
			pm.pluginLoader = l

			err = pm.Add(context.Background(), testPluginID, "1.2.0", plugins.AddOpts{})
			assert.NoError(t, err)

			assert.Equal(t, 2, i.installCount)
			assert.Equal(t, 1, i.uninstallCount)

			assert.Equal(t, 1, pc.startCount)
			assert.Equal(t, 0, pc.stopCount)
			assert.False(t, pc.exited)
			assert.False(t, pc.decommissioned)

			testPlugin, exists := pm.Plugin(context.Background(), testPluginID)
			assert.True(t, exists)
			assert.Equal(t, p.ToDTO(), testPlugin)
			assert.Len(t, pm.Plugins(context.Background()), 1)
		})

		t.Run("Uninstall", func(t *testing.T) {
			err := pm.Remove(context.Background(), p.ID)
			require.NoError(t, err)

			assert.Equal(t, 2, i.installCount)
			assert.Equal(t, 2, i.uninstallCount)

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
		p, pc := createPlugin(testPluginID, "", plugins.Core, true, true)

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins("test/path")
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

		err = pm.Add(context.Background(), testPluginID, "", plugins.AddOpts{})
		assert.Equal(t, plugins.ErrInstallCorePlugin, err)

		t.Run("Can't uninstall core plugin", func(t *testing.T) {
			err := pm.Remove(context.Background(), p.ID)
			require.Equal(t, plugins.ErrUninstallCorePlugin, err)
		})
	})

	t.Run("Can't update bundled plugin", func(t *testing.T) {
		p, pc := createPlugin(testPluginID, "", plugins.Bundled, true, true)

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins("test/path")
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

		err = pm.Add(context.Background(), testPluginID, "", plugins.AddOpts{})
		assert.Equal(t, plugins.ErrInstallCorePlugin, err)

		t.Run("Can't uninstall bundled plugin", func(t *testing.T) {
			err := pm.Remove(context.Background(), p.ID)
			require.Equal(t, plugins.ErrUninstallCorePlugin, err)
		})
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
				assert.True(t, exists)
				require.NotNil(t, testPlugin)

				t.Run("Should not be able to register an already registered plugin", func(t *testing.T) {
					err := ctx.manager.registerAndStart(context.Background(), ctx.plugin)
					require.Equal(t, 1, ctx.pluginClient.startCount)
					require.Error(t, err)
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
						_, err = ctx.manager.CollectMetrics(context.Background(), testPluginID)
						require.Equal(t, backendplugin.ErrMethodNotImplemented, err)
					})

					t.Run("Check health should return method not implemented error", func(t *testing.T) {
						_, err = ctx.manager.CheckHealth(context.Background(), &backend.CheckHealthRequest{PluginContext: backend.PluginContext{PluginID: testPluginID}})
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
						ctx.pluginClient.CollectMetricsHandlerFunc = func(ctx context.Context) (*backend.CollectMetricsResult, error) {
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

						req, err := http.NewRequest(http.MethodGet, "/test", bytes.NewReader([]byte{}))
						require.NoError(t, err)
						w := httptest.NewRecorder()
						err = ctx.manager.callResourceInternal(w, req, backend.PluginContext{PluginID: testPluginID})
						require.NoError(t, err)
						require.Equal(t, http.StatusOK, w.Code)
					})
				})
			})
		})
	})
}

func TestPluginManager_lifecycle_unmanaged(t *testing.T) {
	newScenario(t, false, func(t *testing.T, ctx *managerScenarioCtx) {
		t.Run("Unmanaged plugin scenario", func(t *testing.T) {
			t.Run("Should be able to register plugin", func(t *testing.T) {
				err := ctx.manager.registerAndStart(context.Background(), ctx.plugin)
				require.NoError(t, err)
				require.True(t, ctx.manager.isRegistered(testPluginID))
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

func createManager(t *testing.T, cbs ...func(*PluginManager)) *PluginManager {
	t.Helper()

	staticRootPath, err := filepath.Abs("../../../public/")
	require.NoError(t, err)

	cfg := &setting.Cfg{
		Raw:            ini.Empty(),
		Env:            setting.Prod,
		StaticRootPath: staticRootPath,
	}

	requestValidator := &testPluginRequestValidator{}
	loader := &fakeLoader{}
	pm := newManager(cfg, requestValidator, loader, &sqlstore.SQLStore{})

	for _, cb := range cbs {
		cb(pm)
	}

	return pm
}

func createPlugin(pluginID, version string, class plugins.Class, managed, backend bool) (*plugins.Plugin, *fakePluginClient) {
	p := &plugins.Plugin{
		Class: class,
		JSONData: plugins.JSONData{
			ID:      pluginID,
			Type:    plugins.DataSource,
			Backend: backend,
			Info: plugins.Info{
				Version: version,
			},
		},
	}

	logger := fakeLogger{}

	p.SetLogger(logger)

	pc := &fakePluginClient{
		pluginID: pluginID,
		logger:   logger,
		managed:  managed,
	}

	p.RegisterClient(pc)

	return p, pc
}

type managerScenarioCtx struct {
	manager      *PluginManager
	plugin       *plugins.Plugin
	pluginClient *fakePluginClient
}

func newScenario(t *testing.T, managed bool, fn func(t *testing.T, ctx *managerScenarioCtx)) {
	t.Helper()
	cfg := setting.NewCfg()
	cfg.AWSAllowedAuthProviders = []string{"keys", "credentials"}
	cfg.AWSAssumeRoleEnabled = true

	cfg.Azure.ManagedIdentityEnabled = true
	cfg.Azure.Cloud = "AzureCloud"
	cfg.Azure.ManagedIdentityClientId = "client-id"

	staticRootPath, err := filepath.Abs("../../../public")
	require.NoError(t, err)
	cfg.StaticRootPath = staticRootPath

	requestValidator := &testPluginRequestValidator{}
	loader := &fakeLoader{}
	manager := newManager(cfg, requestValidator, loader, nil)
	manager.pluginLoader = loader
	ctx := &managerScenarioCtx{
		manager: manager,
	}

	ctx.plugin, ctx.pluginClient = createPlugin(testPluginID, "", plugins.Core, managed, true)

	fn(t, ctx)
}

func verifyNoPluginErrors(t *testing.T, pm *PluginManager) {
	for _, plugin := range pm.Plugins(context.Background()) {
		assert.Nil(t, plugin.SignatureError)
	}
}

type fakePluginInstaller struct {
	plugins.Installer

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

func (f *fakePluginInstaller) GetUpdateInfo(ctx context.Context, pluginID, version, pluginRepoURL string) (plugins.UpdateInfo, error) {
	return plugins.UpdateInfo{}, nil
}

type fakeLoader struct {
	mockedLoadedPlugins       []*plugins.Plugin
	mockedFactoryLoadedPlugin *plugins.Plugin

	loadedPaths []string

	plugins.Loader
}

func (l *fakeLoader) Load(paths []string, ignore map[string]struct{}) ([]*plugins.Plugin, error) {
	l.loadedPaths = append(l.loadedPaths, paths...)

	return l.mockedLoadedPlugins, nil
}

func (l *fakeLoader) LoadWithFactory(path string, factory backendplugin.PluginFactoryFunc) (*plugins.Plugin, error) {
	l.loadedPaths = append(l.loadedPaths, path)

	return l.mockedFactoryLoadedPlugin, nil
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

func (tp *fakePluginClient) PluginID() string {
	return tp.pluginID
}

func (tp *fakePluginClient) Logger() log.Logger {
	return tp.logger
}

func (tp *fakePluginClient) Start(ctx context.Context) error {
	tp.mutex.Lock()
	defer tp.mutex.Unlock()
	tp.exited = false
	tp.startCount++
	return nil
}

func (tp *fakePluginClient) Stop(ctx context.Context) error {
	tp.mutex.Lock()
	defer tp.mutex.Unlock()
	tp.stopCount++
	tp.exited = true
	return nil
}

func (tp *fakePluginClient) IsManaged() bool {
	return tp.managed
}

func (tp *fakePluginClient) Exited() bool {
	tp.mutex.RLock()
	defer tp.mutex.RUnlock()
	return tp.exited
}

func (tp *fakePluginClient) Decommission() error {
	tp.mutex.Lock()
	defer tp.mutex.Unlock()

	tp.decommissioned = true

	return nil
}

func (tp *fakePluginClient) IsDecommissioned() bool {
	tp.mutex.RLock()
	defer tp.mutex.RUnlock()
	return tp.decommissioned
}

func (tp *fakePluginClient) kill() {
	tp.mutex.Lock()
	defer tp.mutex.Unlock()
	tp.exited = true
}

func (tp *fakePluginClient) CollectMetrics(ctx context.Context) (*backend.CollectMetricsResult, error) {
	if tp.CollectMetricsHandlerFunc != nil {
		return tp.CollectMetricsHandlerFunc(ctx)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *fakePluginClient) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if tp.CheckHealthHandlerFunc != nil {
		return tp.CheckHealthHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *fakePluginClient) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if tp.QueryDataHandlerFunc != nil {
		return tp.QueryDataHandlerFunc(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *fakePluginClient) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if tp.CallResourceHandlerFunc != nil {
		return tp.CallResourceHandlerFunc(ctx, req, sender)
	}

	return backendplugin.ErrMethodNotImplemented
}

func (tp *fakePluginClient) SubscribeStream(ctx context.Context, request *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *fakePluginClient) PublishStream(ctx context.Context, request *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (tp *fakePluginClient) RunStream(ctx context.Context, request *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return backendplugin.ErrMethodNotImplemented
}

type testPluginRequestValidator struct{}

func (t *testPluginRequestValidator) Validate(string, *http.Request) error {
	return nil
}

type fakeLogger struct {
	log.Logger
}

func (tl fakeLogger) Info(msg string, ctx ...interface{}) {

}

func (tl fakeLogger) Debug(msg string, ctx ...interface{}) {

}
