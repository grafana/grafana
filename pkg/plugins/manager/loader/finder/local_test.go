package finder

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/config"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

func TestFinder_Find(t *testing.T) {
	testData, err := filepath.Abs("../../testdata")
	if err != nil {
		require.NoError(t, err)
	}

	cfg := setting.NewCfg()
	pCfg, err := config.ProvideConfig(setting.ProvideProvider(cfg), cfg)
	require.NoError(t, err)

	testCases := []struct {
		name            string
		pluginDirs      []string
		expectedBundles []*plugins.FoundBundle
		err             error
	}{
		{
			name:       "Dir with single plugin",
			pluginDirs: []string{filepath.Join(testData, "valid-v2-signature")},
			expectedBundles: []*plugins.FoundBundle{
				{
					Primary: plugins.FoundPlugin{
						JSONData: plugins.JSONData{
							ID:   "test-datasource",
							Type: plugins.DataSource,
							Name: "Test",
							Info: plugins.Info{
								Author: plugins.InfoLink{
									Name: "Will Browne",
									URL:  "https://willbrowne.com",
								},
								Description: "Test",
								Version:     "1.0.0",
							},
							Dependencies: plugins.Dependencies{
								GrafanaVersion: "*",
								Plugins:        []plugins.Dependency{},
							},
							State:      plugins.AlphaRelease,
							Backend:    true,
							Executable: "test",
						},
						FS: plugins.NewAllowListLocalFS(map[string]struct{}{
							filepath.Join(testData, "valid-v2-signature/plugin/plugin.json"):  {},
							filepath.Join(testData, "valid-v2-signature/plugin/MANIFEST.txt"): {},
						}, filepath.Join(testData, "valid-v2-signature/plugin"), nil),
					},
				},
			},
		},
		{
			name:       "Dir with nested plugins",
			pluginDirs: []string{"../../testdata/duplicate-plugins"},
			expectedBundles: []*plugins.FoundBundle{
				{
					Primary: plugins.FoundPlugin{
						JSONData: plugins.JSONData{
							ID:   "test-app",
							Type: plugins.DataSource,
							Name: "Parent",
							Info: plugins.Info{
								Author: plugins.InfoLink{
									Name: "Grafana Labs",
									URL:  "http://grafana.com",
								},
								Description: "Parent plugin",
								Version:     "1.0.0",
								Updated:     "2020-10-20",
							},
							Dependencies: plugins.Dependencies{
								GrafanaVersion: "*",
								Plugins:        []plugins.Dependency{},
							},
						},
						FS: plugins.NewAllowListLocalFS(map[string]struct{}{
							filepath.Join(testData, "duplicate-plugins/nested/plugin.json"):         {},
							filepath.Join(testData, "duplicate-plugins/nested/MANIFEST.txt"):        {},
							filepath.Join(testData, "duplicate-plugins/nested/nested/plugin.json"):  {},
							filepath.Join(testData, "duplicate-plugins/nested/nested/MANIFEST.txt"): {},
						}, filepath.Join(testData, "duplicate-plugins/nested"), nil),
					},
					Children: []*plugins.FoundPlugin{
						{
							JSONData: plugins.JSONData{
								ID:   "test-app",
								Type: plugins.DataSource,
								Name: "Child",
								Info: plugins.Info{
									Author: plugins.InfoLink{
										Name: "Grafana Labs",
										URL:  "http://grafana.com",
									},
									Description: "Child plugin",
									Version:     "1.0.0",
									Updated:     "2020-10-20",
								},
								Dependencies: plugins.Dependencies{
									GrafanaVersion: "*",
									Plugins:        []plugins.Dependency{},
								},
							},
							FS: plugins.NewAllowListLocalFS(map[string]struct{}{
								filepath.Join(testData, "duplicate-plugins/nested/nested/plugin.json"):  {},
								filepath.Join(testData, "duplicate-plugins/nested/nested/MANIFEST.txt"): {},
							}, filepath.Join(testData, "duplicate-plugins/nested/nested"), nil),
						},
					},
				},
			},
		},
		{
			name:       "Dir with single plugin which has symbolic link root directory",
			pluginDirs: []string{"../../testdata/symbolic-plugin-dirs"},
			expectedBundles: []*plugins.FoundBundle{
				{
					Primary: plugins.FoundPlugin{
						JSONData: plugins.JSONData{
							ID:   "test-app",
							Type: plugins.App,
							Name: "Test App",
							Info: plugins.Info{
								Author: plugins.InfoLink{
									Name: "Test Inc.",
									URL:  "http://test.com",
								},
								Description: "Official Grafana Test App & Dashboard bundle",
								Version:     "1.0.0",
								Links: []plugins.InfoLink{
									{Name: "Project site", URL: "http://project.com"},
									{Name: "License & Terms", URL: "http://license.com"},
								},
								Updated: "2015-02-10",
								Logos: plugins.Logos{
									Small: "img/logo_small.png",
									Large: "img/logo_large.png",
								},
								Screenshots: []plugins.Screenshots{
									{Name: "img1", Path: "img/screenshot1.png"},
									{Name: "img2", Path: "img/screenshot2.png"},
								},
							},
							Dependencies: plugins.Dependencies{
								GrafanaVersion: "3.x.x",
								Plugins: []plugins.Dependency{
									{ID: "graphite", Type: "datasource", Name: "Graphite", Version: "1.0.0"},
									{ID: "graph", Type: "panel", Name: "Graph", Version: "1.0.0"},
								},
							},
							Includes: []*plugins.Includes{
								{
									Name: "Nginx Connections",
									Path: "dashboards/connections.json",
									Type: "dashboard",
									Role: "Viewer",
								},
								{
									Name: "Nginx Memory",
									Path: "dashboards/memory.json",
									Type: "dashboard",
									Role: "Viewer",
								},
								{Name: "Nginx Panel", Type: "panel", Role: "Viewer"},
								{Name: "Nginx Datasource", Type: "datasource", Role: "Viewer"},
							},
						},
						FS: plugins.NewAllowListLocalFS(map[string]struct{}{
							filepath.Join(testData, "includes-symlinks/MANIFEST.txt"):                 {},
							filepath.Join(testData, "includes-symlinks/dashboards/connections.json"):  {},
							filepath.Join(testData, "includes-symlinks/dashboards/extra/memory.json"): {},
							filepath.Join(testData, "includes-symlinks/plugin.json"):                  {},
							filepath.Join(testData, "includes-symlinks/symlink_to_txt"):               {},
							filepath.Join(testData, "includes-symlinks/text.txt"):                     {},
						}, filepath.Join(testData, "includes-symlinks"), nil),
					},
				},
			},
		},
		{
			name:       "Multiple plugin dirs",
			pluginDirs: []string{"../../testdata/duplicate-plugins", "../../testdata/invalid-v1-signature"},
			expectedBundles: []*plugins.FoundBundle{{
				Primary: plugins.FoundPlugin{
					JSONData: plugins.JSONData{
						ID:   "test-app",
						Type: plugins.DataSource,
						Name: "Parent",
						Info: plugins.Info{
							Author: plugins.InfoLink{
								Name: "Grafana Labs",
								URL:  "http://grafana.com",
							},
							Description: "Parent plugin",
							Version:     "1.0.0",
							Updated:     "2020-10-20",
						},
						Dependencies: plugins.Dependencies{
							GrafanaVersion: "*",
							Plugins:        []plugins.Dependency{},
						},
					},
					FS: plugins.NewAllowListLocalFS(map[string]struct{}{
						filepath.Join(testData, "duplicate-plugins/nested/plugin.json"):         {},
						filepath.Join(testData, "duplicate-plugins/nested/MANIFEST.txt"):        {},
						filepath.Join(testData, "duplicate-plugins/nested/nested/plugin.json"):  {},
						filepath.Join(testData, "duplicate-plugins/nested/nested/MANIFEST.txt"): {},
					}, filepath.Join(testData, "duplicate-plugins/nested"), nil),
				},
				Children: []*plugins.FoundPlugin{
					{
						JSONData: plugins.JSONData{
							ID:   "test-app",
							Type: plugins.DataSource,
							Name: "Child",
							Info: plugins.Info{
								Author: plugins.InfoLink{
									Name: "Grafana Labs",
									URL:  "http://grafana.com",
								},
								Description: "Child plugin",
								Version:     "1.0.0",
								Updated:     "2020-10-20",
							},
							Dependencies: plugins.Dependencies{
								GrafanaVersion: "*",
								Plugins:        []plugins.Dependency{},
							},
						},
						FS: plugins.NewAllowListLocalFS(map[string]struct{}{
							filepath.Join(testData, "duplicate-plugins/nested/nested/plugin.json"):  {},
							filepath.Join(testData, "duplicate-plugins/nested/nested/MANIFEST.txt"): {},
						}, filepath.Join(testData, "duplicate-plugins/nested/nested"), nil),
					},
				},
			},
				{
					Primary: plugins.FoundPlugin{
						JSONData: plugins.JSONData{
							ID:   "test-datasource",
							Type: plugins.DataSource,
							Name: "Test",
							Info: plugins.Info{
								Author: plugins.InfoLink{
									Name: "Grafana Labs",
									URL:  "https://grafana.com",
								},
								Description: "Test",
							},
							Dependencies: plugins.Dependencies{
								GrafanaVersion: "*",
								Plugins:        []plugins.Dependency{},
							},
							State:   plugins.AlphaRelease,
							Backend: true,
						},
						FS: plugins.NewAllowListLocalFS(map[string]struct{}{
							filepath.Join(testData, "invalid-v1-signature/plugin/plugin.json"):  {},
							filepath.Join(testData, "invalid-v1-signature/plugin/MANIFEST.txt"): {},
						}, filepath.Join(testData, "invalid-v1-signature/plugin"), nil),
					},
				},
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			f := NewLocalFinder(pCfg)
			pluginBundles, err := f.Find(context.Background(), &fakes.FakePluginSource{
				PluginURIsFunc: func(ctx context.Context) []string {
					return tc.pluginDirs
				},
			})
			if (err != nil) && !errors.Is(err, tc.err) {
				t.Errorf("Find() error = %v, expected error %v", err, tc.err)
				return
			}

			// to ensure we can compare with expected
			sort.SliceStable(pluginBundles, func(i, j int) bool {
				return pluginBundles[i].Primary.JSONData.ID < pluginBundles[j].Primary.JSONData.ID
			})

			if !cmp.Equal(pluginBundles, tc.expectedBundles, localFSComparer) {
				t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(pluginBundles, tc.expectedBundles, localFSComparer))
			}
		})
	}
}

func TestFinder_getAbsPluginJSONPaths(t *testing.T) {
	cfg := setting.NewCfg()
	pCfg, err := config.ProvideConfig(setting.ProvideProvider(cfg), cfg)
	require.NoError(t, err)

	t.Run("When scanning a folder that doesn't exists shouldn't return an error", func(t *testing.T) {
		origWalk := walk
		walk = func(path string, followSymlinks, detectSymlinkInfiniteLoop bool, walkFn util.WalkFunc) error {
			return walkFn(path, nil, os.ErrNotExist)
		}
		t.Cleanup(func() {
			walk = origWalk
		})

		finder := NewLocalFinder(pCfg)
		paths, err := finder.getAbsPluginJSONPaths("test")
		require.NoError(t, err)
		require.Empty(t, paths)
	})

	t.Run("When scanning a folder that lacks permission shouldn't return an error", func(t *testing.T) {
		origWalk := walk
		walk = func(path string, followSymlinks, detectSymlinkInfiniteLoop bool, walkFn util.WalkFunc) error {
			return walkFn(path, nil, os.ErrPermission)
		}
		t.Cleanup(func() {
			walk = origWalk
		})

		finder := NewLocalFinder(pCfg)
		paths, err := finder.getAbsPluginJSONPaths("test")
		require.NoError(t, err)
		require.Empty(t, paths)
	})

	t.Run("When scanning a folder that returns a non-handled error should return that error", func(t *testing.T) {
		origWalk := walk
		walk = func(path string, followSymlinks, detectSymlinkInfiniteLoop bool, walkFn util.WalkFunc) error {
			return walkFn(path, nil, fmt.Errorf("random error"))
		}
		t.Cleanup(func() {
			walk = origWalk
		})

		finder := NewLocalFinder(pCfg)
		paths, err := finder.getAbsPluginJSONPaths("test")
		require.Error(t, err)
		require.Empty(t, paths)
	})
}

func TestFinder_validatePluginJSON(t *testing.T) {
	type args struct {
		data plugins.JSONData
	}
	tests := []struct {
		name string
		args args
		err  error
	}{
		{
			name: "Valid case",
			args: args{
				data: plugins.JSONData{
					ID:   "grafana-plugin-id",
					Type: plugins.DataSource,
				},
			},
		},
		{
			name: "Invalid plugin ID",
			args: args{
				data: plugins.JSONData{
					Type: plugins.Panel,
				},
			},
			err: ErrInvalidPluginJSON,
		},
		{
			name: "Invalid plugin type",
			args: args{
				data: plugins.JSONData{
					ID:   "grafana-plugin-id",
					Type: "test",
				},
			},
			err: ErrInvalidPluginJSON,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := validatePluginJSON(tt.args.data); !errors.Is(err, tt.err) {
				t.Errorf("validatePluginJSON() = %v, want %v", err, tt.err)
			}
		})
	}
}

func TestFinder_readPluginJSON(t *testing.T) {
	tests := []struct {
		name       string
		pluginPath string
		expected   plugins.JSONData
		err        error
	}{
		{
			name:       "Valid plugin",
			pluginPath: "../../testdata/test-app/plugin.json",
			expected: plugins.JSONData{
				ID:   "test-app",
				Type: "app",
				Name: "Test App",
				Info: plugins.Info{
					Author: plugins.InfoLink{
						Name: "Test Inc.",
						URL:  "http://test.com",
					},
					Description: "Official Grafana Test App & Dashboard bundle",
					Version:     "1.0.0",
					Links: []plugins.InfoLink{
						{Name: "Project site", URL: "http://project.com"},
						{Name: "License & Terms", URL: "http://license.com"},
					},
					Logos: plugins.Logos{
						Small: "img/logo_small.png",
						Large: "img/logo_large.png",
					},
					Screenshots: []plugins.Screenshots{
						{Path: "img/screenshot1.png", Name: "img1"},
						{Path: "img/screenshot2.png", Name: "img2"},
					},
					Updated: "2015-02-10",
				},
				Dependencies: plugins.Dependencies{
					GrafanaVersion: "3.x.x",
					Plugins: []plugins.Dependency{
						{Type: "datasource", ID: "graphite", Name: "Graphite", Version: "1.0.0"},
						{Type: "panel", ID: "graph", Name: "Graph", Version: "1.0.0"},
					},
				},
				Includes: []*plugins.Includes{
					{Name: "Nginx Connections", Path: "dashboards/connections.json", Type: "dashboard", Role: org.RoleViewer},
					{Name: "Nginx Memory", Path: "dashboards/memory.json", Type: "dashboard", Role: org.RoleViewer},
					{Name: "Nginx Panel", Type: "panel", Role: org.RoleViewer},
					{Name: "Nginx Datasource", Type: "datasource", Role: org.RoleViewer},
				},
				Backend: false,
			},
		},
		{
			name:       "Invalid plugin JSON",
			pluginPath: "../../testdata/invalid-plugin-json/plugin.json",
			err:        ErrInvalidPluginJSON,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			reader, err := os.Open(tt.pluginPath)
			require.NoError(t, err)
			got, err := ReadPluginJSON(reader)
			if tt.err != nil {
				require.ErrorIs(t, err, tt.err)
			}
			if !cmp.Equal(got, tt.expected) {
				t.Errorf("Unexpected pluginJSONData: %v", cmp.Diff(got, tt.expected))
			}
			require.NoError(t, reader.Close())
		})
	}
}

var localFSComparer = cmp.Comparer(func(fs1 plugins.LocalFS, fs2 plugins.LocalFS) bool {
	fs1Files, err := fs1.Files()
	if err != nil {
		panic(err)
	}
	fs2Files, err := fs2.Files()
	if err != nil {
		panic(err)
	}

	sort.SliceStable(fs1Files, func(i, j int) bool {
		return fs1Files[i] < fs1Files[j]
	})

	sort.SliceStable(fs2Files, func(i, j int) bool {
		return fs2Files[i] < fs2Files[j]
	})

	return cmp.Equal(fs1Files, fs2Files) && fs1.Base() == fs2.Base()
})
