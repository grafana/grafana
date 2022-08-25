package manager

import (
	"archive/zip"
	"context"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
)

const testPluginID = "test-plugin"

func TestPluginManager_Run(t *testing.T) {
	t.Run("Plugin sources are loaded in order", func(t *testing.T) {
		loader := &fakeLoader{}
		pm := New(&plugins.Cfg{}, newFakePluginRegistry(), []plugins.PluginSource{
			{Class: plugins.Bundled, Paths: []string{"path1"}},
			{Class: plugins.Core, Paths: []string{"path2"}},
			{Class: plugins.External, Paths: []string{"path3"}},
		}, loader, &fakePluginRepo{}, &fakePluginStorage{}, &fakeProcessManager{})

		err := pm.Run(context.Background())
		require.NoError(t, err)
		require.Equal(t, []string{"path1", "path2", "path3"}, loader.loadedPaths)
	})
}

func TestPluginManager_lifecycle_managed(t *testing.T) {
	newScenario(t, true, func(t *testing.T, ctx *managerScenarioCtx) {
		t.Run("Backend core plugin is registered but not started", func(t *testing.T) {
			ctx.plugin.Class = plugins.Core
			err := ctx.manager.registerAndStart(context.Background(), ctx.plugin)
			require.NoError(t, err)
			require.NotNil(t, ctx.plugin)
			require.Equal(t, testPluginID, ctx.plugin.ID)
			require.Equal(t, 0, ctx.pluginClient.startCount)
			testPlugin, exists := ctx.manager.plugin(context.Background(), testPluginID)
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
				p, exists := ctx.manager.plugin(context.Background(), testPluginID)
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
						runErr = ctx.processManager.Run(cCtx)
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

				// Move to process_test.go
				//t.Run("Should be not be able to start unmanaged plugin", func(t *testing.T) {
				//	pCtx := context.Background()
				//	cCtx, cancel := context.WithCancel(pCtx)
				//	defer cancel()
				//	err := ctx.manager.start(cCtx, ctx.plugin)
				//	require.Nil(t, err)
				//	require.Equal(t, 0, ctx.pluginClient.startCount)
				//	require.True(t, ctx.plugin.Exited())
				//})
			})
		})
	})
}

type fakePluginRepo struct {
	getPluginArchiveFunc         func(_ context.Context, pluginID, version string, _ repo.CompatOpts) (*repo.PluginArchive, error)
	getPluginArchiveByURLFunc    func(_ context.Context, archiveURL string, _ repo.CompatOpts) (*repo.PluginArchive, error)
	getPluginDownloadOptionsFunc func(_ context.Context, pluginID, version string, _ repo.CompatOpts) (*repo.PluginDownloadOptions, error)
}

// GetPluginArchive fetches the requested plugin archive.
func (r *fakePluginRepo) GetPluginArchive(ctx context.Context, pluginID, version string, opts repo.CompatOpts) (*repo.PluginArchive, error) {
	if r.getPluginArchiveFunc != nil {
		return r.getPluginArchiveFunc(ctx, pluginID, version, opts)
	}

	return &repo.PluginArchive{}, nil
}

// GetPluginArchiveByURL fetches the requested plugin from the specified URL.
func (r *fakePluginRepo) GetPluginArchiveByURL(ctx context.Context, archiveURL string, opts repo.CompatOpts) (*repo.PluginArchive, error) {
	if r.getPluginArchiveByURLFunc != nil {
		return r.getPluginArchiveByURLFunc(ctx, archiveURL, opts)
	}

	return &repo.PluginArchive{}, nil
}

// GetPluginDownloadOptions fetches information for downloading the requested plugin.
func (r *fakePluginRepo) GetPluginDownloadOptions(ctx context.Context, pluginID, version string, opts repo.CompatOpts) (*repo.PluginDownloadOptions, error) {
	if r.getPluginDownloadOptionsFunc != nil {
		return r.getPluginDownloadOptionsFunc(ctx, pluginID, version, opts)
	}
	return &repo.PluginDownloadOptions{}, nil
}

type fakePluginStorage struct {
	addFunc    func(_ context.Context, pluginID string, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error)
	removeFunc func(_ context.Context, pluginID string) error
	added      map[string]string
	removed    map[string]int
}

func (s *fakePluginStorage) Add(ctx context.Context, pluginID string, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error) {
	s.added[pluginID] = z.File[0].Name
	if s.addFunc != nil {
		return s.addFunc(ctx, pluginID, z)
	}
	return &storage.ExtractedPluginArchive{}, nil
}

func (s *fakePluginStorage) Remove(ctx context.Context, pluginID string) error {
	s.removed[pluginID]++
	if s.removeFunc != nil {
		return s.removeFunc(ctx, pluginID)
	}
	return nil
}

type fakeProcessManager struct {
	startFunc func(_ context.Context, pluginID string) error
	stopFunc  func(_ context.Context, pluginID string) error
	started   map[string]int
	stopped   map[string]int
}

func (m *fakeProcessManager) Start(ctx context.Context, pluginID string) error {
	m.started[pluginID]++
	if m.startFunc != nil {
		return m.startFunc(ctx, pluginID)
	}
	return nil
}

func (m *fakeProcessManager) Stop(ctx context.Context, pluginID string) error {
	m.stopped[pluginID]++
	if m.stopFunc != nil {
		return m.stopFunc(ctx, pluginID)
	}
	return nil
}
