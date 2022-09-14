package manager

import (
	"archive/zip"
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/repo"
	"github.com/grafana/grafana/pkg/plugins/storage"
)

const testPluginID = "test-plugin"

func TestPluginManager_Add_Remove(t *testing.T) {
	t.Run("Adding a new plugin", func(t *testing.T) {
		const (
			pluginID, v1 = "test-panel", "1.0.0"
			zipNameV1    = "test-panel-1.0.0.zip"
		)

		// mock a plugin to be returned automatically by the plugin loader
		pluginV1 := createPlugin(t, pluginID, plugins.External, true, true, func(plugin *plugins.Plugin) {
			plugin.Info.Version = v1
		})
		mockZipV1 := &zip.ReadCloser{Reader: zip.Reader{File: []*zip.File{{
			FileHeader: zip.FileHeader{Name: zipNameV1},
		}}}}

		loader := &fakes.FakeLoader{
			LoadFunc: func(_ context.Context, _ plugins.Class, paths []string, _ map[string]struct{}) ([]*plugins.Plugin, error) {
				require.Equal(t, []string{zipNameV1}, paths)
				return []*plugins.Plugin{pluginV1}, nil
			},
		}

		pluginRepo := &fakes.FakePluginRepo{
			GetPluginArchiveFunc: func(_ context.Context, pluginID, version string, _ repo.CompatOpts) (*repo.PluginArchive, error) {
				require.Equal(t, pluginV1.ID, pluginID)
				require.Equal(t, v1, version)
				return &repo.PluginArchive{
					File: mockZipV1,
				}, nil
			},
		}

		fs := &fakes.FakePluginStorage{
			AddFunc: func(_ context.Context, pluginID string, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error) {
				require.Equal(t, pluginV1.ID, pluginID)
				require.Equal(t, mockZipV1, z)
				return &storage.ExtractedPluginArchive{
					Path: zipNameV1,
				}, nil
			},
			Added:   make(map[string]string),
			Removed: make(map[string]int),
		}
		proc := fakes.NewFakeProcessManager()

		pm := New(&plugins.Cfg{}, fakes.NewFakePluginRegistry(), []plugins.PluginSource{}, loader, pluginRepo, fs, proc)
		err := pm.Add(context.Background(), pluginID, v1, plugins.CompatOpts{})
		require.NoError(t, err)

		require.Equal(t, zipNameV1, fs.Added[pluginID])
		require.Equal(t, 0, fs.Removed[pluginID])
		require.Equal(t, 1, proc.Started[pluginID])
		require.Equal(t, 0, proc.Stopped[pluginID])

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
			pluginV2 := createPlugin(t, pluginID, plugins.External, true, true, func(plugin *plugins.Plugin) {
				plugin.Info.Version = v2
			})

			mockZipV2 := &zip.ReadCloser{Reader: zip.Reader{File: []*zip.File{{
				FileHeader: zip.FileHeader{Name: zipNameV2},
			}}}}
			loader.LoadFunc = func(_ context.Context, class plugins.Class, paths []string, ignore map[string]struct{}) ([]*plugins.Plugin, error) {
				require.Equal(t, plugins.External, class)
				require.Empty(t, ignore)
				require.Equal(t, []string{zipNameV2}, paths)
				return []*plugins.Plugin{pluginV2}, nil
			}
			pluginRepo.GetPluginDownloadOptionsFunc = func(_ context.Context, pluginID, version string, _ repo.CompatOpts) (*repo.PluginDownloadOptions, error) {
				return &repo.PluginDownloadOptions{
					PluginZipURL: "https://grafanaplugins.com",
				}, nil
			}
			pluginRepo.GetPluginArchiveByURLFunc = func(_ context.Context, pluginZipURL string, _ repo.CompatOpts) (*repo.PluginArchive, error) {
				require.Equal(t, "https://grafanaplugins.com", pluginZipURL)
				return &repo.PluginArchive{
					File: mockZipV2,
				}, nil
			}
			fs.AddFunc = func(_ context.Context, pluginID string, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error) {
				require.Equal(t, pluginV1.ID, pluginID)
				require.Equal(t, mockZipV2, z)
				return &storage.ExtractedPluginArchive{
					Path: zipNameV2,
				}, nil
			}

			err = pm.Add(context.Background(), pluginID, v2, plugins.CompatOpts{})
			require.NoError(t, err)

			require.Equal(t, zipNameV2, fs.Added[pluginID])
			require.Equal(t, 1, fs.Removed[pluginID])
			require.Equal(t, 2, proc.Started[pluginID])
			require.Equal(t, 1, proc.Stopped[pluginID])

			regPlugin, exists = pm.pluginRegistry.Plugin(context.Background(), pluginID)
			require.True(t, exists)
			require.Equal(t, pluginV2, regPlugin)
			require.Len(t, pm.pluginRegistry.Plugins(context.Background()), 1)
		})

		t.Run("Removing an existing plugin", func(t *testing.T) {
			err = pm.Remove(context.Background(), pluginID)
			require.NoError(t, err)

			require.Equal(t, 2, proc.Stopped[pluginID])
			require.Equal(t, 2, fs.Removed[pluginID])

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
			p := createPlugin(t, testPluginID, tc.class, true, true, func(plugin *plugins.Plugin) {
				plugin.Info.Version = "1.0.0"
			})

			fakes.NewFakePluginRegistry()

			reg := &fakes.FakePluginRegistry{
				Store: map[string]*plugins.Plugin{
					testPluginID: p,
				},
			}

			proc := fakes.NewFakeProcessManager()
			pm := New(&plugins.Cfg{}, reg, []plugins.PluginSource{}, &fakes.FakeLoader{}, &fakes.FakePluginRepo{}, &fakes.FakePluginStorage{}, proc)
			err := pm.Add(context.Background(), p.ID, "3.2.0", plugins.CompatOpts{})
			require.ErrorIs(t, err, plugins.ErrInstallCorePlugin)

			require.Equal(t, 0, proc.Started[p.ID])
			require.Equal(t, 0, proc.Stopped[p.ID])

			regPlugin, exists := pm.pluginRegistry.Plugin(context.Background(), testPluginID)
			require.True(t, exists)
			require.Equal(t, p, regPlugin)
			require.Len(t, pm.pluginRegistry.Plugins(context.Background()), 1)

			err = pm.Add(context.Background(), testPluginID, "", plugins.CompatOpts{})
			require.Equal(t, plugins.ErrInstallCorePlugin, err)

			t.Run("Can't uninstall core plugin", func(t *testing.T) {
				err = pm.Remove(context.Background(), p.ID)
				require.Equal(t, plugins.ErrUninstallCorePlugin, err)
			})
		}
	})
}

func TestPluginManager_Run(t *testing.T) {
	t.Run("Plugin sources are loaded in order", func(t *testing.T) {
		loader := &fakes.FakeLoader{}
		pm := New(&plugins.Cfg{}, fakes.NewFakePluginRegistry(), []plugins.PluginSource{
			{Class: plugins.Bundled, Paths: []string{"path1"}},
			{Class: plugins.Core, Paths: []string{"path2"}},
			{Class: plugins.External, Paths: []string{"path3"}},
		}, loader, &fakes.FakePluginRepo{}, &fakes.FakePluginStorage{}, &fakes.FakeProcessManager{})

		err := pm.Init(context.Background())
		require.NoError(t, err)
		require.Equal(t, []string{"path1", "path2", "path3"}, loader.LoadedPaths)
	})
}

func TestManager_Renderer(t *testing.T) {
	t.Run("Renderer returns a single (non-decommissioned) renderer plugin", func(t *testing.T) {
		p1 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-renderer", Type: plugins.Renderer}}
		p2 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-panel", Type: plugins.Panel}}
		p3 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-app", Type: plugins.App}}

		reg := &fakes.FakePluginRegistry{
			Store: map[string]*plugins.Plugin{
				p1.ID: p1,
				p2.ID: p2,
				p3.ID: p3,
			},
		}

		pm := New(&plugins.Cfg{}, reg, []plugins.PluginSource{}, &fakes.FakeLoader{}, &fakes.FakePluginRepo{},
			&fakes.FakePluginStorage{}, &fakes.FakeProcessManager{})

		r := pm.Renderer(context.Background())
		require.Equal(t, p1, r)
	})
}

func TestManager_SecretsManager(t *testing.T) {
	t.Run("Renderer returns a single (non-decommissioned) secrets manager plugin", func(t *testing.T) {
		p1 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-renderer", Type: plugins.Renderer}}
		p2 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-panel", Type: plugins.Panel}}
		p3 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-secrets", Type: plugins.SecretsManager}}
		p4 := &plugins.Plugin{JSONData: plugins.JSONData{ID: "test-datasource", Type: plugins.DataSource}}

		reg := &fakes.FakePluginRegistry{
			Store: map[string]*plugins.Plugin{
				p1.ID: p1,
				p2.ID: p2,
				p3.ID: p3,
				p4.ID: p4,
			},
		}

		pm := New(&plugins.Cfg{}, reg, []plugins.PluginSource{}, &fakes.FakeLoader{}, &fakes.FakePluginRepo{},
			&fakes.FakePluginStorage{}, &fakes.FakeProcessManager{})

		r := pm.SecretsManager(context.Background())
		require.Equal(t, p3, r)
	})
}

func createPlugin(t *testing.T, pluginID string, class plugins.Class, managed, backend bool, cbs ...func(*plugins.Plugin)) *plugins.Plugin {
	t.Helper()

	p := &plugins.Plugin{
		Class: class,
		JSONData: plugins.JSONData{
			ID:      pluginID,
			Type:    plugins.DataSource,
			Backend: backend,
		},
	}
	p.SetLogger(log.NewNopLogger())
	p.RegisterClient(&fakes.FakePluginClient{
		ID:      pluginID,
		Managed: managed,
		Log:     p.Logger(),
	})

	for _, cb := range cbs {
		cb(p)
	}

	return p
}
