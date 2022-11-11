package finder

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana/pkg/services/org"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/util"
)

func TestFinder_Find(t *testing.T) {
	testCases := []struct {
		name               string
		pluginDirs         []string
		expectedPathSuffix []string
		err                error
	}{
		{
			name:               "Dir with single plugin",
			pluginDirs:         []string{"../../testdata/valid-v2-signature"},
			expectedPathSuffix: []string{"/pkg/plugins/manager/testdata/valid-v2-signature/plugin/plugin.json"},
		},
		{
			name:       "Dir with nested plugins",
			pluginDirs: []string{"../../testdata/duplicate-plugins"},
			expectedPathSuffix: []string{
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/nested/plugin.json",
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/plugin.json",
			},
		},
		{
			name:               "Dir with single plugin which has symbolic link root directory",
			pluginDirs:         []string{"../../testdata/symbolic-plugin-dirs"},
			expectedPathSuffix: []string{"/pkg/plugins/manager/testdata/includes-symlinks/plugin.json"},
		},
		{
			name:       "Multiple plugin dirs",
			pluginDirs: []string{"../../testdata/duplicate-plugins", "../../testdata/invalid-v1-signature"},
			expectedPathSuffix: []string{
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/nested/plugin.json",
				"/pkg/plugins/manager/testdata/duplicate-plugins/nested/plugin.json",
				"/pkg/plugins/manager/testdata/invalid-v1-signature/plugin/plugin.json"},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			f := New()
			pluginPaths, err := f.Find(tc.pluginDirs)
			if (err != nil) && !errors.Is(err, tc.err) {
				t.Errorf("Find() error = %v, expected error %v", err, tc.err)
				return
			}

			assert.Equal(t, len(tc.expectedPathSuffix), len(pluginPaths))
			for i := 0; i < len(tc.expectedPathSuffix); i++ {
				assert.True(t, strings.HasSuffix(pluginPaths[i], tc.expectedPathSuffix[i]))
			}
		})
	}
}

func TestFinder_getAbsPluginJSONPaths(t *testing.T) {
	t.Run("When scanning a folder that doesn't exists shouldn't return an error", func(t *testing.T) {
		origWalk := walk
		walk = func(path string, followSymlinks, detectSymlinkInfiniteLoop bool, walkFn util.WalkFunc) error {
			return walkFn(path, nil, os.ErrNotExist)
		}
		t.Cleanup(func() {
			walk = origWalk
		})

		finder := &Finder{
			log: log.New(),
		}

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

		finder := &Finder{
			log: log.New(),
		}

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

		finder := &Finder{
			log: log.New(),
		}

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
		failed     bool
	}{
		{
			name:       "Valid plugin",
			pluginPath: "../testdata/test-app/plugin.json",
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
			pluginPath: "../testdata/invalid-plugin-json/plugin.json",
			failed:     true,
		},
		{
			name:       "Non-existing JSON file",
			pluginPath: "nonExistingFile.json",
			failed:     true,
		},
	}

	f := Newv2()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := f.readPluginJSON(tt.pluginPath)
			if (err != nil) && !tt.failed {
				t.Errorf("readPluginJSON() error = %v, failed %v", err, tt.failed)
				return
			}
			if !cmp.Equal(got, tt.expected, compareOpts) {
				t.Errorf("Unexpected pluginJSONData: %v", cmp.Diff(got, tt.expected, compareOpts))
			}
		})
	}
}
