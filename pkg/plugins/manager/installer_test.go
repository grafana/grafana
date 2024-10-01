package manager

import (
	"archive/zip"
	"context"
	"fmt"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/log"
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
			v2           = "2.0.0"
			zipNameV2    = "test-panel-2.0.0.zip"
		)

		// mock a plugin to be returned automatically by the plugin loader
		pluginV1 := createPlugin(t, pluginID, plugins.ClassExternal, true, true, func(plugin *plugins.Plugin) {
			plugin.Info.Version = v1
		})
		mockZipV1 := &zip.ReadCloser{Reader: zip.Reader{File: []*zip.File{{
			FileHeader: zip.FileHeader{Name: zipNameV1},
		}}}}

		var loadedPaths []string
		loader := &fakes.FakeLoader{
			LoadFunc: func(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
				loadedPaths = append(loadedPaths, src.PluginURIs(ctx)...)
				require.Equal(t, []string{zipNameV1}, src.PluginURIs(ctx))
				return []*plugins.Plugin{pluginV1}, nil
			},
			UnloadFunc: func(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
				return p, nil
			},
		}

		pluginRepo := &fakes.FakePluginRepo{
			GetPluginArchiveFunc: func(_ context.Context, id, version string, _ repo.CompatOpts) (*repo.PluginArchive, error) {
				require.Equal(t, pluginID, id)
				require.Equal(t, v1, version)
				return &repo.PluginArchive{
					File: mockZipV1,
				}, nil
			},
		}

		fs := &fakes.FakePluginStorage{
			ExtractFunc: func(_ context.Context, id string, _ storage.DirNameGeneratorFunc, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error) {
				require.Equal(t, pluginID, id)
				require.Equal(t, mockZipV1, z)
				return &storage.ExtractedPluginArchive{
					Path: zipNameV1,
				}, nil
			},
		}

		inst := New(fakes.NewFakePluginRegistry(), loader, pluginRepo, fs, storage.SimpleDirNameGeneratorFunc, &fakes.FakeAuthService{})
		err := inst.Add(context.Background(), pluginID, v1, testCompatOpts())
		require.NoError(t, err)

		t.Run("Won't add if already exists", func(t *testing.T) {
			inst.pluginRegistry = &fakes.FakePluginRegistry{
				Store: map[string]*plugins.Plugin{
					pluginID: pluginV1,
				},
			}

			err = inst.Add(context.Background(), pluginID, v1, testCompatOpts())
			require.Equal(t, plugins.DuplicateError{
				PluginID: pluginV1.ID,
			}, err)
		})

		t.Run("Update plugin to different version", func(t *testing.T) {
			// mock a plugin to be returned automatically by the plugin loader
			pluginV2 := createPlugin(t, pluginID, plugins.ClassExternal, true, true, func(plugin *plugins.Plugin) {
				plugin.Info.Version = v2
			})

			mockZipV2 := &zip.ReadCloser{Reader: zip.Reader{File: []*zip.File{{
				FileHeader: zip.FileHeader{Name: zipNameV2},
			}}}}
			loader.LoadFunc = func(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
				require.Equal(t, plugins.ClassExternal, src.PluginClass(ctx))
				require.Equal(t, []string{zipNameV2}, src.PluginURIs(ctx))
				return []*plugins.Plugin{pluginV2}, nil
			}
			pluginRepo.GetPluginArchiveInfoFunc = func(_ context.Context, _, _ string, _ repo.CompatOpts) (*repo.PluginArchiveInfo, error) {
				return &repo.PluginArchiveInfo{
					URL: "https://grafanaplugins.com",
				}, nil
			}
			pluginRepo.GetPluginArchiveByURLFunc = func(_ context.Context, pluginZipURL string, _ repo.CompatOpts) (*repo.PluginArchive, error) {
				require.Equal(t, "https://grafanaplugins.com", pluginZipURL)
				return &repo.PluginArchive{
					File: mockZipV2,
				}, nil
			}
			fs.ExtractFunc = func(_ context.Context, pluginID string, _ storage.DirNameGeneratorFunc, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error) {
				require.Equal(t, pluginV1.ID, pluginID)
				require.Equal(t, mockZipV2, z)
				return &storage.ExtractedPluginArchive{
					Path: zipNameV2,
				}, nil
			}

			err = inst.Add(context.Background(), pluginID, v2, testCompatOpts())
			require.NoError(t, err)
		})

		t.Run("Removing an existing plugin", func(t *testing.T) {
			inst.pluginRegistry = &fakes.FakePluginRegistry{
				Store: map[string]*plugins.Plugin{
					pluginID: pluginV1,
				},
			}

			var unloadedPlugins []string
			inst.pluginLoader = &fakes.FakeLoader{
				UnloadFunc: func(_ context.Context, p *plugins.Plugin) (*plugins.Plugin, error) {
					unloadedPlugins = append(unloadedPlugins, p.ID)
					return p, nil
				},
			}

			err = inst.Remove(context.Background(), pluginID, v2)
			require.NoError(t, err)

			require.Equal(t, []string{pluginID}, unloadedPlugins)

			t.Run("Won't remove if not exists", func(t *testing.T) {
				inst.pluginRegistry = fakes.NewFakePluginRegistry()

				err = inst.Remove(context.Background(), pluginID, v2)
				require.Equal(t, plugins.ErrPluginNotInstalled, err)
			})
		})
	})

	t.Run("Can't update core or bundled plugin", func(t *testing.T) {
		tcs := []struct {
			class plugins.Class
		}{
			{class: plugins.ClassCore},
			{class: plugins.ClassBundled},
		}

		for _, tc := range tcs {
			p := createPlugin(t, testPluginID, tc.class, true, true, func(plugin *plugins.Plugin) {
				plugin.Info.Version = "1.0.0"
			})

			reg := &fakes.FakePluginRegistry{
				Store: map[string]*plugins.Plugin{
					testPluginID: p,
				},
			}

			pm := New(reg, &fakes.FakeLoader{}, &fakes.FakePluginRepo{}, &fakes.FakePluginStorage{}, storage.SimpleDirNameGeneratorFunc, &fakes.FakeAuthService{})
			err := pm.Add(context.Background(), p.ID, "3.2.0", testCompatOpts())
			require.ErrorIs(t, err, plugins.ErrInstallCorePlugin)

			err = pm.Add(context.Background(), testPluginID, "", testCompatOpts())
			require.Equal(t, plugins.ErrInstallCorePlugin, err)

			t.Run(fmt.Sprintf("Can't uninstall %s plugin", tc.class), func(t *testing.T) {
				err = pm.Remove(context.Background(), p.ID, p.Info.Version)
				require.Equal(t, plugins.ErrUninstallCorePlugin, err)
			})
		}
	})

	t.Run("Can install multiple dependency levels", func(t *testing.T) {
		const (
			p1, p1Zip = "foo-panel", "foo-panel.zip"
			p2, p2Zip = "foo-datasource", "foo-datasource.zip"
			p3, p3Zip = "foo-app", "foo-app.zip"
		)

		var loadedPaths []string
		loader := &fakes.FakeLoader{
			LoadFunc: func(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
				loadedPaths = append(loadedPaths, src.PluginURIs(ctx)...)
				return []*plugins.Plugin{}, nil
			},
		}

		pluginRepo := &fakes.FakePluginRepo{
			GetPluginArchiveFunc: func(_ context.Context, id, version string, _ repo.CompatOpts) (*repo.PluginArchive, error) {
				return &repo.PluginArchive{File: &zip.ReadCloser{Reader: zip.Reader{File: []*zip.File{{
					FileHeader: zip.FileHeader{Name: fmt.Sprintf("%s.zip", id)},
				}}}}}, nil
			},
		}

		fs := &fakes.FakePluginStorage{
			ExtractFunc: func(_ context.Context, id string, _ storage.DirNameGeneratorFunc, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error) {
				switch id {
				case p1:
					return &storage.ExtractedPluginArchive{Path: p1Zip}, nil
				case p2:
					return &storage.ExtractedPluginArchive{
						Dependencies: []*storage.Dependency{{ID: p1}},
						Path:         p2Zip,
					}, nil
				case p3:
					return &storage.ExtractedPluginArchive{
						Dependencies: []*storage.Dependency{{ID: p2}},
						Path:         p3Zip,
					}, nil
				default:
					return nil, fmt.Errorf("unknown plugin %s", id)
				}
			},
		}

		inst := New(fakes.NewFakePluginRegistry(), loader, pluginRepo, fs, storage.SimpleDirNameGeneratorFunc, &fakes.FakeAuthService{})
		err := inst.Add(context.Background(), p3, "", testCompatOpts())
		require.NoError(t, err)
		require.Equal(t, []string{p1Zip, p2Zip, p3Zip}, loadedPaths)
	})

	t.Run("Livelock prevented when two plugins depend on each other", func(t *testing.T) {
		const (
			p1, p1Zip = "foo-panel", "foo-panel.zip"
			p2, p2Zip = "foo-datasource", "foo-datasource.zip"
		)

		var loadedPaths []string
		loader := &fakes.FakeLoader{
			LoadFunc: func(ctx context.Context, src plugins.PluginSource) ([]*plugins.Plugin, error) {
				loadedPaths = append(loadedPaths, src.PluginURIs(ctx)...)
				return []*plugins.Plugin{}, nil
			},
		}

		pluginRepo := &fakes.FakePluginRepo{
			GetPluginArchiveFunc: func(_ context.Context, id, version string, _ repo.CompatOpts) (*repo.PluginArchive, error) {
				return &repo.PluginArchive{File: &zip.ReadCloser{Reader: zip.Reader{File: []*zip.File{{
					FileHeader: zip.FileHeader{Name: fmt.Sprintf("%s.zip", id)},
				}}}}}, nil
			},
		}

		fs := &fakes.FakePluginStorage{
			ExtractFunc: func(_ context.Context, id string, _ storage.DirNameGeneratorFunc, z *zip.ReadCloser) (*storage.ExtractedPluginArchive, error) {
				switch id {
				case p1:
					return &storage.ExtractedPluginArchive{
						Dependencies: []*storage.Dependency{{ID: p2}},
						Path:         p1Zip,
					}, nil
				case p2:
					return &storage.ExtractedPluginArchive{
						Dependencies: []*storage.Dependency{{ID: p1}},
						Path:         p2Zip,
					}, nil
				default:
					return nil, fmt.Errorf("unknown plugin %s", id)
				}
			},
		}

		inst := New(fakes.NewFakePluginRegistry(), loader, pluginRepo, fs, storage.SimpleDirNameGeneratorFunc, &fakes.FakeAuthService{})
		err := inst.Add(context.Background(), p1, "", testCompatOpts())
		require.NoError(t, err)
		require.Equal(t, []string{p2Zip, p1Zip}, loadedPaths)
	})
}

func createPlugin(t *testing.T, pluginID string, class plugins.Class, managed, backend bool, cbs ...func(*plugins.Plugin)) *plugins.Plugin {
	t.Helper()

	p := &plugins.Plugin{
		Class: class,
		JSONData: plugins.JSONData{
			ID:      pluginID,
			Type:    plugins.TypeDataSource,
			Backend: backend,
		},
	}
	p.SetLogger(log.NewTestLogger())
	if p.Backend {
		p.RegisterClient(&fakes.FakePluginClient{
			ID:      pluginID,
			Managed: managed,
			Log:     p.Logger(),
		})
	}

	for _, cb := range cbs {
		cb(p)
	}

	return p
}

func testCompatOpts() plugins.CompatOpts {
	return plugins.NewCompatOpts("10.0.0", runtime.GOOS, runtime.GOARCH)
}
