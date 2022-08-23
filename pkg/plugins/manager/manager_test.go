package manager

import (
	"archive/zip"
	"context"
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
)

func TestPluginManager_Run(t *testing.T) {
	t.Run("Plugin sources are loaded in order", func(t *testing.T) {
		loader := &fakeLoader{}
		pm := New(&plugins.Cfg{}, newFakePluginRegistry(), []plugins.PluginSource{
			{Class: plugins.Bundled, Paths: []string{"path1"}},
			{Class: plugins.Core, Paths: []string{"path2"}},
			{Class: plugins.External, Paths: []string{"path3"}},
		}, loader, &fakePluginRepo{})

		err := pm.Run(context.Background())
		require.NoError(t, err)
		require.Equal(t, []string{"path1", "path2", "path3"}, loader.loadedPaths)
	})
}

func TestPluginManager_loadPlugins(t *testing.T) {
	t.Run("Managed backend plugin", func(t *testing.T) {
		p, pc := createPlugin(t, testPluginID, plugins.External, true, true)

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm, ps := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins(context.Background(), plugins.External, "test/path")
		require.NoError(t, err)

		assert.Equal(t, 1, pc.startCount)
		assert.Equal(t, 0, pc.stopCount)
		assert.False(t, pc.exited)
		assert.False(t, pc.decommissioned)

		testPlugin, exists := ps.Plugin(context.Background(), testPluginID)
		assert.True(t, exists)
		assert.Equal(t, p.ToDTO(), testPlugin)
		assert.Len(t, ps.Plugins(context.Background()), 1)

		verifyNoPluginErrors(t, pm.pluginRegistry)
	})

	t.Run("Unmanaged backend plugin", func(t *testing.T) {
		p, pc := createPlugin(t, testPluginID, plugins.External, false, true)

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm, ps := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins(context.Background(), plugins.External, "test/path")
		require.NoError(t, err)

		assert.Equal(t, 0, pc.startCount)
		assert.Equal(t, 0, pc.stopCount)
		assert.False(t, pc.exited)
		assert.False(t, pc.decommissioned)

		testPlugin, exists := ps.Plugin(context.Background(), testPluginID)
		assert.True(t, exists)
		assert.Equal(t, p.ToDTO(), testPlugin)
		assert.Len(t, ps.Plugins(context.Background()), 1)

		verifyNoPluginErrors(t, pm.pluginRegistry)
	})

	t.Run("Managed non-backend plugin", func(t *testing.T) {
		p, pc := createPlugin(t, testPluginID, plugins.External, false, true)

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm, ps := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins(context.Background(), plugins.External, "test/path")
		require.NoError(t, err)

		assert.Equal(t, 0, pc.startCount)
		assert.Equal(t, 0, pc.stopCount)
		assert.False(t, pc.exited)
		assert.False(t, pc.decommissioned)

		testPlugin, exists := ps.Plugin(context.Background(), testPluginID)
		assert.True(t, exists)
		assert.Equal(t, p.ToDTO(), testPlugin)
		assert.Len(t, ps.Plugins(context.Background()), 1)

		verifyNoPluginErrors(t, pm.pluginRegistry)
	})

	t.Run("Unmanaged non-backend plugin", func(t *testing.T) {
		p, pc := createPlugin(t, testPluginID, plugins.External, false, false)

		loader := &fakeLoader{
			mockedLoadedPlugins: []*plugins.Plugin{p},
		}

		pm, ps := createManager(t, func(pm *PluginManager) {
			pm.pluginLoader = loader
		})
		err := pm.loadPlugins(context.Background(), plugins.External, "test/path")
		require.NoError(t, err)

		assert.Equal(t, 0, pc.startCount)
		assert.Equal(t, 0, pc.stopCount)
		assert.False(t, pc.exited)
		assert.False(t, pc.decommissioned)

		testPlugin, exists := ps.Plugin(context.Background(), testPluginID)
		assert.True(t, exists)
		assert.Equal(t, p.ToDTO(), testPlugin)
		assert.Len(t, ps.Plugins(context.Background()), 1)

		verifyNoPluginErrors(t, pm.pluginRegistry)
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
				testPlugin, exists := ctx.manager.plugin(context.Background(), testPluginID)
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
						runErr = ctx.processManager.Run(cCtx)
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
						runErr = ctx.processManager.Run(cCtx)
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
	store map[string]fakePluginEntry

	repo.Service
}

type fakePluginEntry struct {
	z        *zip.ReadCloser
	zipURL   string
	version  string
	checksum string
}

// GetPluginArchive fetches the requested plugin archive.
func (r *fakePluginRepo) GetPluginArchive(_ context.Context, pluginID, version string, opts repo.CompatOpts) (*repo.PluginArchive, error) {
	key := fmt.Sprintf("%s-%s-%s", pluginID, version, opts.String())
	v, exists := r.store[key]
	if !exists {
		return nil, fmt.Errorf("plugin archive not found")
	}

	return &repo.PluginArchive{
		File: v.z,
	}, nil
}

// GetPluginArchiveByURL fetches the requested plugin from the specified URL.
func (r *fakePluginRepo) GetPluginArchiveByURL(_ context.Context, archiveURL string, opts repo.CompatOpts) (*repo.PluginArchive, error) {
	key := fmt.Sprintf("%s-%s", archiveURL, opts.String())
	v, exists := r.store[key]
	if !exists {
		return nil, fmt.Errorf("plugin archive not found")
	}

	return &repo.PluginArchive{
		File: v.z,
	}, nil
}

// GetPluginDownloadOptions fetches information for downloading the requested plugin.
func (r *fakePluginRepo) GetPluginDownloadOptions(_ context.Context, pluginID, version string, opts repo.CompatOpts) (*repo.PluginDownloadOptions, error) {
	key := fmt.Sprintf("%s-%s-%s", pluginID, version, opts.String())
	v, exists := r.store[key]
	if !exists {
		return nil, fmt.Errorf("plugin archive not found")
	}

	return &repo.PluginDownloadOptions{
		PluginZipURL: v.zipURL,
		Version:      v.version,
		Checksum:     v.checksum,
	}, nil
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
