package manager

import (
	"context"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	testPluginID = "test-plugin"
)

func TestPluginManager_loadPlugins(t *testing.T) {
	t.Run("Managed backend plugin", func(t *testing.T) {
		p, pc := createPlugin(testPluginID, "", plugins.External, true, true)

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
		p, pc := createPlugin(testPluginID, "", plugins.External, false, true)

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
		p, pc := createPlugin(testPluginID, "", plugins.External, false, true)

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
		p, pc := createPlugin(testPluginID, "", plugins.External, false, false)

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

		err := pm.Add(context.Background(), testPluginID, "1.0.0")
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
			err := pm.Add(context.Background(), testPluginID, "1.0.0")
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

			err = pm.Add(context.Background(), testPluginID, "1.2.0")
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
		err := pm.loadPlugins(context.Background(), plugins.Core, "test/path")
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

		err = pm.Add(context.Background(), testPluginID, "")
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

		err = pm.Add(context.Background(), testPluginID, "")
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

	requestValidator := &testPluginRequestValidator{}
	pm := New(&plugins.Cfg{}, requestValidator, nil, &fakeLoader{}, &sqlstore.SQLStore{})

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
	cfg := &plugins.Cfg{}
	cfg.AWSAllowedAuthProviders = []string{"keys", "credentials"}
	cfg.AWSAssumeRoleEnabled = true

	cfg.Azure.ManagedIdentityEnabled = true
	cfg.Azure.Cloud = "AzureCloud"
	cfg.Azure.ManagedIdentityClientId = "client-id"

	requestValidator := &testPluginRequestValidator{}
	loader := &fakeLoader{}
	manager := New(cfg, requestValidator, nil, loader, nil)
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

func (f *fakePluginInstaller) Install(_ context.Context, _, _, _, _, _ string) error {
	f.installCount++
	return nil
}

func (f *fakePluginInstaller) Uninstall(_ context.Context, _ string) error {
	f.uninstallCount++
	return nil
}

func (f *fakePluginInstaller) GetUpdateInfo(_ context.Context, _, _, _ string) (plugins.UpdateInfo, error) {
	return plugins.UpdateInfo{}, nil
}

type fakeLoader struct {
	mockedLoadedPlugins       []*plugins.Plugin
	mockedFactoryLoadedPlugin *plugins.Plugin

	loadedPaths []string

	plugins.Loader
}

func (l *fakeLoader) Load(_ context.Context, _ plugins.Class, paths []string, _ map[string]struct{}) ([]*plugins.Plugin, error) {
	l.loadedPaths = append(l.loadedPaths, paths...)

	return l.mockedLoadedPlugins, nil
}

func (l *fakeLoader) LoadWithFactory(_ context.Context, _ plugins.Class, path string, _ backendplugin.PluginFactoryFunc) (*plugins.Plugin, error) {
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

func (pc *fakePluginClient) CollectMetrics(ctx context.Context) (*backend.CollectMetricsResult, error) {
	if pc.CollectMetricsHandlerFunc != nil {
		return pc.CollectMetricsHandlerFunc(ctx)
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

type testPluginRequestValidator struct{}

func (t *testPluginRequestValidator) Validate(string, *http.Request) error {
	return nil
}

type fakeLogger struct {
	log.Logger
}

func (l fakeLogger) Info(_ string, _ ...interface{}) {

}

func (l fakeLogger) Debug(_ string, _ ...interface{}) {

}

type fakeSender struct {
	resp *backend.CallResourceResponse
}

func (s *fakeSender) Send(crr *backend.CallResourceResponse) error {
	s.resp = crr

	return nil
}
