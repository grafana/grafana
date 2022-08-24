package manager

import (
	"archive/zip"
	"context"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/plugins/storage"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/manager/process"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/manager/store"
	"github.com/grafana/grafana/pkg/plugins/repo"
)

func TestPluginInstaller(t *testing.T) {
	t.Run("Can add a plugin from source", func(t *testing.T) {
		src := []plugins.PluginSource{
			{
				Class: plugins.Core,
				Paths: []string{"../../../../public/app/plugins/datasource/prometheus"},
			},
		}

		pm := New(&plugins.Cfg{}, newFakePluginRegistry(), src, &fakeLoader{}, &fakePluginRepo{}, &fakePluginStorage{}, &fakeProcessManager{})
		err := pm.Run(context.Background())
		require.NoError(t, err)

		p, exists := pm.plugin(context.Background(), "prometheus")
		require.True(t, exists)
		require.NotNil(t, p)
	})

	t.Run("Adding a new plugin", func(t *testing.T) {
		const (
			pluginID, v1 = "test-panel", "1.0.0"
			zipNameV1    = "test-panel-1.0.0.zip"
		)

		// mock a plugin to be returned automatically by the plugin loader
		pluginV1, _ := createPlugin(t, pluginID, plugins.External, true, true, func(plugin *plugins.Plugin) {
			plugin.Info.Version = v1
		})
		mockZipV1 := &zip.ReadCloser{Reader: zip.Reader{File: []*zip.File{{
			FileHeader: zip.FileHeader{Name: zipNameV1},
		}}}}

		loader := &fakeLoader{
			loadFunc: func(_ context.Context, _ plugins.Class, paths []string, _ map[string]struct{}) ([]*plugins.Plugin, error) {
				require.Equal(t, []string{zipNameV1}, paths)
				return []*plugins.Plugin{pluginV1}, nil
			},
		}

		pluginRepo := &fakePluginRepo{
			getPluginArchiveFunc: func(_ context.Context, pluginID, version string, _ repo.CompatOpts) (*repo.PluginArchive, error) {
				require.Equal(t, pluginV1.ID, pluginID)
				require.Equal(t, v1, version)
				return &repo.PluginArchive{
					File: mockZipV1,
				}, nil
			},
		}

		fs := &fakePluginStorage{
			addFunc: func(_ context.Context, pluginID string, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error) {
				require.Equal(t, pluginV1.ID, pluginID)
				require.Equal(t, mockZipV1, z)
				return &storage.ExtractedPluginArchive{
					Path: zipNameV1,
				}, nil
			},
			added:   make(map[string]string),
			removed: make(map[string]int),
		}
		proc := &fakeProcessManager{
			started: make(map[string]int),
			stopped: make(map[string]int),
		}

		pm := New(&plugins.Cfg{}, newFakePluginRegistry(), []plugins.PluginSource{}, loader, pluginRepo, fs, proc)
		err := pm.Add(context.Background(), pluginID, v1, plugins.CompatOpts{})
		require.NoError(t, err)

		verifyNoPluginErrors(t, pm.pluginRegistry)

		require.Equal(t, zipNameV1, fs.added[pluginID])
		require.Equal(t, 0, fs.removed[pluginID])
		require.Equal(t, 1, proc.started[pluginID])
		require.Equal(t, 0, proc.stopped[pluginID])

		regPlugin, exists := pm.pluginRegistry.Plugin(context.Background(), pluginID)
		require.True(t, exists)
		require.Equal(t, pluginV1, regPlugin)
		require.Len(t, pm.pluginRegistry.Plugins(context.Background()), 1)

		t.Run("Won't add if already exists", func(t *testing.T) {
			err = pm.Add(context.Background(), pluginID, v1, plugins.CompatOpts{})
			require.Equal(t, plugins.DuplicateError{
				PluginID:          pluginV1.ID,
				ExistingPluginDir: pluginV1.PluginDir,
			}, err)
		})

		t.Run("Update plugin to different version", func(t *testing.T) {
			const (
				v2        = "2.0.0"
				zipNameV2 = "test-panel-2.0.0.zip"
			)
			// mock a plugin to be returned automatically by the plugin loader
			pluginV2, _ := createPlugin(t, pluginID, plugins.External, true, true, func(plugin *plugins.Plugin) {
				plugin.Info.Version = v2
			})

			mockZipV2 := &zip.ReadCloser{Reader: zip.Reader{File: []*zip.File{{
				FileHeader: zip.FileHeader{Name: zipNameV2},
			}}}}
			loader.loadFunc = func(_ context.Context, class plugins.Class, paths []string, ignore map[string]struct{}) ([]*plugins.Plugin, error) {
				require.Equal(t, plugins.External, class)
				require.Empty(t, ignore)
				require.Equal(t, []string{zipNameV2}, paths)
				return []*plugins.Plugin{pluginV2}, nil
			}
			pluginRepo.getPluginDownloadOptionsFunc = func(_ context.Context, pluginID, version string, _ repo.CompatOpts) (*repo.PluginDownloadOptions, error) {
				return &repo.PluginDownloadOptions{
					PluginZipURL: "https://grafanaplugins.com",
				}, nil
			}
			pluginRepo.getPluginArchiveByURLFunc = func(_ context.Context, pluginZipURL string, _ repo.CompatOpts) (*repo.PluginArchive, error) {
				require.Equal(t, "https://grafanaplugins.com", pluginZipURL)
				return &repo.PluginArchive{
					File: mockZipV2,
				}, nil
			}
			fs.addFunc = func(_ context.Context, pluginID string, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error) {
				require.Equal(t, pluginV1.ID, pluginID)
				require.Equal(t, mockZipV2, z)
				return &storage.ExtractedPluginArchive{
					Path: zipNameV2,
				}, nil
			}

			err = pm.Add(context.Background(), pluginID, v2, plugins.CompatOpts{})
			require.NoError(t, err)

			verifyNoPluginErrors(t, pm.pluginRegistry)

			require.Equal(t, zipNameV2, fs.added[pluginID])
			require.Equal(t, 1, fs.removed[pluginID])
			require.Equal(t, 2, proc.started[pluginID])
			require.Equal(t, 1, proc.stopped[pluginID])

			regPlugin, exists = pm.pluginRegistry.Plugin(context.Background(), pluginID)
			require.True(t, exists)
			require.Equal(t, pluginV2, regPlugin)
			require.Len(t, pm.pluginRegistry.Plugins(context.Background()), 1)
		})

		t.Run("Removing an existing plugin", func(t *testing.T) {
			err = pm.Remove(context.Background(), pluginID)
			require.NoError(t, err)

			require.Equal(t, 2, proc.stopped[pluginID])
			require.Equal(t, 2, fs.removed[pluginID])

			p, exists := pm.pluginRegistry.Plugin(context.Background(), pluginID)
			require.False(t, exists)
			require.Nil(t, p)

			t.Run("Won't remove if not exists", func(t *testing.T) {
				err := pm.Remove(context.Background(), pluginID)
				require.Equal(t, plugins.ErrPluginNotInstalled, err)
			})
		})
	})

	t.Run("Can't update core or bundled plugin", func(t *testing.T) {
		tcs := []struct {
			class plugins.Class
		}{
			{class: plugins.Core},
			{class: plugins.Bundled},
		}

		for _, tc := range tcs {
			p, _ := createPlugin(t, testPluginID, tc.class, true, true, func(plugin *plugins.Plugin) {
				plugin.Info.Version = "1.0.0"
			})

			reg := &fakePluginRegistry{map[string]*plugins.Plugin{
				testPluginID: p,
			}}

			proc := &fakeProcessManager{}
			pm := New(&plugins.Cfg{}, reg, []plugins.PluginSource{}, &fakeLoader{}, &fakePluginRepo{}, &fakePluginStorage{}, proc)
			err := pm.Add(context.Background(), p.ID, "3.2.0", plugins.CompatOpts{})
			require.ErrorIs(t, err, plugins.ErrInstallCorePlugin)

			require.Equal(t, 0, proc.started[p.ID])
			require.Equal(t, 0, proc.stopped[p.ID])

			regPlugin, exists := pm.pluginRegistry.Plugin(context.Background(), testPluginID)
			require.True(t, exists)
			require.Equal(t, p, regPlugin)
			require.Len(t, pm.pluginRegistry.Plugins(context.Background()), 1)
			verifyNoPluginErrors(t, pm.pluginRegistry)

			err = pm.Add(context.Background(), testPluginID, "", plugins.CompatOpts{})
			require.Equal(t, plugins.ErrInstallCorePlugin, err)

			t.Run("Can't uninstall core plugin", func(t *testing.T) {
				err := pm.Remove(context.Background(), p.ID)
				require.Equal(t, plugins.ErrUninstallCorePlugin, err)
			})
		}
	})
}

// TODO move to store_test.go?

func createManager(t *testing.T, cbs ...func(*PluginManager)) (*PluginManager, plugins.Store) {
	t.Helper()

	pm := New(&plugins.Cfg{}, newFakePluginRegistry(), []plugins.PluginSource{}, &fakeLoader{}, &fakePluginRepo{},
		&fakePluginStorage{}, &fakeProcessManager{})

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
	processManager := process.NewManager(pluginRegistry)
	manager := New(cfg, pluginRegistry, []plugins.PluginSource{}, &fakeLoader{}, &fakePluginRepo{}, &fakePluginStorage{}, processManager)
	ctx := &managerScenarioCtx{
		manager:        manager,
		processManager: processManager,
	}

	ctx.plugin, ctx.pluginClient = createPlugin(t, "test-datasource", plugins.External, managed, true)

	fn(t, ctx)
}

func verifyNoPluginErrors(t *testing.T, pr registry.Service) {
	for _, plugin := range pr.Plugins(context.Background()) {
		require.Nil(t, plugin.SignatureError)
	}
}

type fakeLoader struct {
	//TODO tidy up
	loadFunc func(_ context.Context, _ plugins.Class, paths []string, _ map[string]struct{}) ([]*plugins.Plugin, error)

	loadedPaths []string
}

func (l *fakeLoader) Load(ctx context.Context, class plugins.Class, paths []string, ignore map[string]struct{}) ([]*plugins.Plugin, error) {
	if l.loadFunc != nil {
		return l.loadFunc(ctx, class, paths, ignore)
	}

	l.loadedPaths = append(l.loadedPaths, paths...)

	return nil, nil
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
