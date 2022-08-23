package manager

import (
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
)

const (
	testPluginID = "test-plugin"
)

func TestPluginInstaller(t *testing.T) {
	t.Run("Adding a plugin", func(t *testing.T) {
		p, pc := createPlugin(t, testPluginID, plugins.External, true, true)

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		repo := &fakePluginRepo{}

		reg := newFakePluginRegistry()

		pm := New(&plugins.Cfg{}, reg, []plugins.PluginSource{}, loader, repo)

		err := pm.Add(context.Background(), testPluginID, "1.0.0", plugins.CompatOpts{})
		require.NoError(t, err)

		//assert.Equal(t, 1, i.installCount)
		//assert.Equal(t, 0, i.uninstallCount)

		verifyNoPluginErrors(t, pm.pluginRegistry)

		assert.Equal(t, 1, pc.startCount)
		assert.Equal(t, 0, pc.stopCount)
		assert.False(t, pc.exited)
		assert.False(t, pc.decommissioned)

		testPlugin, exists := reg.Plugin(context.Background(), testPluginID)
		assert.True(t, exists)
		assert.Equal(t, p.ToDTO(), testPlugin)
		assert.Len(t, reg.Plugins(context.Background()), 1)

		t.Run("Won't install if already installed", func(t *testing.T) {
			err := pm.Add(context.Background(), testPluginID, "1.0.0", plugins.CompatOpts{})
			require.Equal(t, plugins.DuplicateError{
				PluginID:          p.ID,
				ExistingPluginDir: p.PluginDir,
			}, err)
		})

		t.Run("Update", func(t *testing.T) {
			p, pc := createPlugin(t, testPluginID, plugins.External, true, true, func(plugin *plugins.Plugin) {
				plugin.Info.Version = "1.2.0"
			})

			l := &fakeLoader{
				mockedLoadedPlugins: []*plugins.Plugin{p},
			}
			pm.pluginLoader = l

			err = pm.Add(context.Background(), testPluginID, "1.2.0", plugins.CompatOpts{})
			assert.NoError(t, err)

			//assert.Equal(t, 2, i.installCount)
			//assert.Equal(t, 1, i.uninstallCount)

			assert.Equal(t, 1, pc.startCount)
			assert.Equal(t, 0, pc.stopCount)
			assert.False(t, pc.exited)
			assert.False(t, pc.decommissioned)

			testPlugin, exists := reg.Plugin(context.Background(), testPluginID)
			assert.True(t, exists)
			assert.Equal(t, p.ToDTO(), testPlugin)
			assert.Len(t, reg.Plugins(context.Background()), 1)
		})

		t.Run("Removing a plugin", func(t *testing.T) {
			err = pm.Remove(context.Background(), p.ID)
			require.NoError(t, err)

			//assert.Equal(t, 2, i.installCount)
			//assert.Equal(t, 2, i.uninstallCount)

			p, exists := reg.Plugin(context.Background(), p.ID)
			assert.False(t, exists)
			assert.Equal(t, plugins.PluginDTO{}, p)

			t.Run("Won't remove if not installed", func(t *testing.T) {
				err := pm.Remove(context.Background(), p.ID)
				require.Equal(t, plugins.ErrPluginNotInstalled, err)
			})
		})
	})

	//t.Run("Can't update core plugin", func(t *testing.T) {
	//	p, pc := createPlugin(t, testPluginID, "", plugins.Core, true, true)
	//
	//	loader := &fakeLoader{
	//		mockedLoadedPlugins: []*plugins.Plugin{p},
	//	}
	//
	//	pm, ps := createInstaller(t, func(pm *PluginInstaller) {
	//		pm.pluginLoader = loader
	//	})
	//	err := pm.loadPlugins(context.Background(), plugins.Core, "test/path")
	//	require.NoError(t, err)
	//
	//	assert.Equal(t, 0, pc.startCount)
	//	assert.Equal(t, 0, pc.stopCount)
	//	assert.False(t, pc.exited)
	//	assert.False(t, pc.decommissioned)
	//
	//	testPlugin, exists := ps.Plugin(context.Background(), testPluginID)
	//	assert.True(t, exists)
	//	assert.Equal(t, p.ToDTO(), testPlugin)
	//	assert.Len(t, ps.Plugins(context.Background()), 1)
	//
	//	verifyNoPluginErrors(t, pm.pluginRegistry)
	//
	//	err = pm.Add(context.Background(), testPluginID, "")
	//	assert.Equal(t, plugins.ErrInstallCorePlugin, err)
	//
	//	t.Run("Can't uninstall core plugin", func(t *testing.T) {
	//		err := pm.Remove(context.Background(), p.ID)
	//		require.Equal(t, plugins.ErrUninstallCorePlugin, err)
	//	})
	//})

	//t.Run("Can't update bundled plugin", func(t *testing.T) {
	//	p, pc := createPlugin(t, testPluginID, "", plugins.Bundled, true, true)
	//
	//	loader := &fakeLoader{
	//		mockedLoadedPlugins: []*plugins.Plugin{p},
	//	}
	//
	//	pm, ps := createInstaller(t, func(pm *PluginInstaller) {
	//		pm.pluginLoader = loader
	//	})
	//	err := pm.loadPlugins(context.Background(),  "test/path")
	//	require.NoError(t, err)
	//
	//	assert.Equal(t, 1, pc.startCount)
	//	assert.Equal(t, 0, pc.stopCount)
	//	assert.False(t, pc.exited)
	//	assert.False(t, pc.decommissioned)
	//
	//	testPlugin, exists := ps.Plugin(context.Background(), testPluginID)
	//	assert.True(t, exists)
	//	assert.Equal(t, p.ToDTO(), testPlugin)
	//	assert.Len(t, ps.Plugins(context.Background()), 1)
	//
	//	verifyNoPluginErrors(t, pm.pluginRegistry)
	//
	//	err = pm.Add(context.Background(), testPluginID, "")
	//	assert.Equal(t, plugins.ErrInstallCorePlugin, err)
	//
	//	t.Run("Can't uninstall bundled plugin", func(t *testing.T) {
	//		err := pm.Remove(context.Background(), p.ID)
	//		require.Equal(t, plugins.ErrUninstallCorePlugin, err)
	//	})
	//})
}

// TODO move to store_test.go?
//func TestPluginManager_registeredPlugins(t *testing.T) {
//	t.Run("Decommissioned plugins are included in registeredPlugins", func(t *testing.T) {
//		decommissionedPlugin, _ := createPlugin(t, testPluginID, "", plugins.Core, false, true,
//			func(plugin *plugins.Plugin) {
//				err := plugin.Decommission()
//				require.NoError(t, err)
//			},
//		)
//		require.True(t, decommissionedPlugin.IsDecommissioned())
//
//		pm := New(&plugins.Cfg{}, &fakePluginRegistry{
//			store: map[string]*plugins.Plugin{
//				testPluginID: decommissionedPlugin,
//				"test-app":   {},
//			},
//		}, []plugins.PluginSource{}, &fakeLoader{}, &fakePluginInstaller{}, &fakePluginProcessManager{})
//
//		rps := pm.registeredPlugins(context.Background())
//		require.Equal(t, 2, len(rps))
//		require.NotNil(t, rps[testPluginID])
//		require.NotNil(t, rps["test-app"])
//	})
//}

func createManager(t *testing.T, cbs ...func(*PluginManager)) (*PluginManager, plugins.Store) {
	t.Helper()

	pm := New(&plugins.Cfg{}, newFakePluginRegistry(), []plugins.PluginSource{}, &fakeLoader{}, &fakePluginRepo{})

	for _, cb := range cbs {
		cb(pm)
	}

	return pm, store.ProvideService(pm.pluginRegistry)
}

func createPlugin(t *testing.T, pluginID string, class plugins.Class, managed, backend bool, cbs ...func(*plugins.Plugin)) (*plugins.Plugin, *fakePluginClient) {
	t.Helper()

	p := &plugins.Plugin{
		Class: class,
		JSONData: plugins.JSONData{
			ID:      pluginID,
			Type:    plugins.DataSource,
			Backend: backend,
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

type managerScenarioCtx struct {
	processManager *process.Manager
	manager        *PluginManager
	plugin         *plugins.Plugin
	pluginClient   *fakePluginClient
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

	pluginRegistry := registry.NewInMemory()
	manager := New(cfg, pluginRegistry, []plugins.PluginSource{}, &fakeLoader{}, &fakePluginRepo{})
	processManager := process.NewManager(pluginRegistry)
	ctx := &managerScenarioCtx{
		manager:        manager,
		processManager: processManager,
	}

	ctx.plugin, ctx.pluginClient = createPlugin(t, testPluginID, plugins.External, managed, true)

	fn(t, ctx)
}

func verifyNoPluginErrors(t *testing.T, pr registry.Service) {
	for _, plugin := range pr.Plugins(context.Background()) {
		assert.Nil(t, plugin.SignatureError)
	}
}

//type fakePluginProcessManager struct {
//	started map[string]int
//	stopped map[string]int
//}
//
//func newFakePluginProcessManager() *fakePluginProcessManager {
//	return &fakePluginProcessManager{
//		started: make(map[string]int),
//		stopped: make(map[string]int),
//	}
//}
//
//func (f *fakePluginProcessManager) Start(_ context.Context, pluginID string) error {
//	f.started[pluginID] += 1
//	return nil
//}
//
//func (f *fakePluginProcessManager) Stop(_ context.Context, pluginID string) error {
//	f.stopped[pluginID] += 1
//	return nil
//}
//
//func (f *fakePluginProcessManager) Shutdown(_ context.Context) {
//
//}

type fakePluginManager struct {
	installCount   int
	uninstallCount int
}

func (f *fakePluginManager) Add(ctx context.Context, pluginID, version string, opts plugins.CompatOpts) error {
	f.installCount++
	return nil
}

func (f *fakePluginManager) Remove(ctx context.Context, pluginID string) error {
	f.uninstallCount++
	return nil
}

func (f *fakePluginManager) AddFromSource(ctx context.Context, source plugins.PluginSource) error {
	return nil
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
