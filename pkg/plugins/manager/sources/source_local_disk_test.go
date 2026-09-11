package sources

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/log"
)

var compareOpts = []cmp.Option{cmpopts.IgnoreFields(LocalSource{}, "log"), cmp.AllowUnexported(LocalSource{})}

func TestDirAsLocalSources(t *testing.T) {
	testdataDir := "../testdata"

	tests := []struct {
		name         string
		pluginsPaths []string
		cfg          *config.PluginManagementCfg
		expected     []*LocalSource
	}{
		{
			name:         "Empty path returns no sources",
			pluginsPaths: []string{},
			expected:     []*LocalSource{},
		},
		{
			name:         "Directory with subdirectories",
			pluginsPaths: []string{filepath.Join(testdataDir, "pluginRootWithDist")},
			cfg:          &config.PluginManagementCfg{},
			expected: []*LocalSource{
				{
					paths:      []string{filepath.Join(testdataDir, "pluginRootWithDist", "datasource")},
					strictMode: true,
					class:      plugins.ClassExternal,
				},
				{
					paths:      []string{filepath.Join(testdataDir, "pluginRootWithDist", "dist")},
					strictMode: true,
					class:      plugins.ClassExternal,
				},
				{
					paths:      []string{filepath.Join(testdataDir, "pluginRootWithDist", "panel")},
					strictMode: true,
					class:      plugins.ClassExternal,
				},
			},
		},
		{
			name: "Dev mode disables strict mode for source",
			cfg: &config.PluginManagementCfg{
				DevMode: true,
			},
			pluginsPaths: []string{filepath.Join(testdataDir, "pluginRootWithDist")},
			expected: []*LocalSource{
				{
					paths:      []string{filepath.Join(testdataDir, "pluginRootWithDist", "datasource")},
					class:      plugins.ClassExternal,
					strictMode: false,
				},
				{
					paths:      []string{filepath.Join(testdataDir, "pluginRootWithDist", "dist")},
					class:      plugins.ClassExternal,
					strictMode: false,
				},
				{
					paths:      []string{filepath.Join(testdataDir, "pluginRootWithDist", "panel")},
					class:      plugins.ClassExternal,
					strictMode: false,
				},
			},
		},
		{
			name:         "Directory with no subdirectories",
			cfg:          &config.PluginManagementCfg{},
			pluginsPaths: []string{filepath.Join(testdataDir, "pluginRootWithDist", "datasource")},
			expected:     []*LocalSource{},
		},
		{
			name:         "Directory with a symlink to a directory",
			pluginsPaths: []string{filepath.Join(testdataDir, "symbolic-plugin-dirs")},
			cfg:          &config.PluginManagementCfg{},
			expected: []*LocalSource{
				{
					paths:      []string{filepath.Join(testdataDir, "symbolic-plugin-dirs", "plugin")},
					class:      plugins.ClassExternal,
					strictMode: true,
				},
			},
		},
		{
			name:         "Multiple paths",
			pluginsPaths: []string{filepath.Join(testdataDir, "pluginRootWithDist"), filepath.Join(testdataDir, "symbolic-plugin-dirs")},
			cfg:          &config.PluginManagementCfg{},
			expected: []*LocalSource{
				{
					paths:      []string{filepath.Join(testdataDir, "pluginRootWithDist", "datasource")},
					class:      plugins.ClassExternal,
					strictMode: true,
				},
				{
					paths:      []string{filepath.Join(testdataDir, "pluginRootWithDist", "dist")},
					class:      plugins.ClassExternal,
					strictMode: true,
				},
				{
					paths:      []string{filepath.Join(testdataDir, "pluginRootWithDist", "panel")},
					class:      plugins.ClassExternal,
					strictMode: true,
				},
				{
					paths:      []string{filepath.Join(testdataDir, "symbolic-plugin-dirs", "plugin")},
					class:      plugins.ClassExternal,
					strictMode: true,
				},
			},
		},
		{
			name:         "Non existing directories are skipped",
			cfg:          &config.PluginManagementCfg{},
			pluginsPaths: []string{filepath.Join(testdataDir, "pluginRootWithDist", "nope")},
			expected:     []*LocalSource{},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := DirAsLocalSources(tt.cfg, tt.pluginsPaths, plugins.ClassExternal, log.New("test.logger"))
			if !cmp.Equal(got, tt.expected, compareOpts...) {
				t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, tt.expected, compareOpts...))
			}
		})
	}
}

func TestDirAsLocalSourcesSkipsUnreadableDirectory(t *testing.T) {
	unreadableDir := filepath.Join(t.TempDir(), "unreadable")
	require.NoError(t, os.Mkdir(unreadableDir, 0750))
	readableDir := filepath.Join("..", "testdata", "pluginRootWithDist")

	t.Cleanup(func() {
		// Restore permissions so TempDir cleanup can remove the directory.
		_ = os.Chmod(unreadableDir, 0750) //nolint:gosec // Directory needs execute permission to allow traversal during cleanup.
	})
	require.NoError(t, os.Chmod(unreadableDir, 0))

	_, err := os.ReadDir(unreadableDir)
	if err == nil {
		t.Skip("filesystem does not enforce directory read permissions in this environment")
	}

	got := DirAsLocalSources(&config.PluginManagementCfg{}, []string{unreadableDir, readableDir}, plugins.ClassExternal, log.New("test.logger"))
	expected := []*LocalSource{
		{
			paths:      []string{filepath.Join(readableDir, "datasource")},
			strictMode: true,
			class:      plugins.ClassExternal,
		},
		{
			paths:      []string{filepath.Join(readableDir, "dist")},
			strictMode: true,
			class:      plugins.ClassExternal,
		},
		{
			paths:      []string{filepath.Join(readableDir, "panel")},
			strictMode: true,
			class:      plugins.ClassExternal,
		},
	}
	if !cmp.Equal(got, expected, compareOpts...) {
		t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, expected, compareOpts...))
	}
}

func TestLocalSource(t *testing.T) {
	t.Run("NewLocalSource should always return plugins with StaticFS", func(t *testing.T) {
		tmpDir := t.TempDir()
		pluginID := "test-plugin"
		pluginDir := filepath.Join(tmpDir, pluginID)

		err := os.MkdirAll(pluginDir, 0750)
		require.NoError(t, err)

		pluginJSON := `{
			"id": "test-plugin",
			"name": "Test Plugin",
			"type": "datasource",
			"info": {
				"version": "1.0.0"
			}
		}`
		err = os.WriteFile(filepath.Join(pluginDir, "plugin.json"), []byte(pluginJSON), 0644)
		require.NoError(t, err)

		bundles, err := NewLocalSource(plugins.ClassExternal, []string{pluginDir}).Discover(t.Context())
		require.NoError(t, err)
		require.Len(t, bundles, 1, "Should discover exactly one plugin")
		require.Equal(t, pluginID, bundles[0].Primary.JSONData.ID)
		_, canRemove := bundles[0].Primary.FS.(plugins.FSRemover)
		require.True(t, canRemove)
	})
}
