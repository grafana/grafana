package sources

import (
	"errors"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/config"
)

var compareOpts = []cmp.Option{cmpopts.IgnoreFields(LocalSource{}, "log"), cmp.AllowUnexported(LocalSource{})}

func TestDirAsLocalSources(t *testing.T) {
	testdataDir := "../testdata"

	tests := []struct {
		name        string
		pluginsPath string
		cfg         *config.PluginManagementCfg
		expected    []*LocalSource
		err         error
	}{
		{
			name:        "Empty path returns an error",
			pluginsPath: "",
			expected:    []*LocalSource{},
			err:         errors.New("plugins path not configured"),
		},
		{
			name:        "Directory with subdirectories",
			pluginsPath: filepath.Join(testdataDir, "pluginRootWithDist"),
			cfg:         &config.PluginManagementCfg{},
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
			pluginsPath: filepath.Join(testdataDir, "pluginRootWithDist"),
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
			name:        "Directory with no subdirectories",
			cfg:         &config.PluginManagementCfg{},
			pluginsPath: filepath.Join(testdataDir, "pluginRootWithDist", "datasource"),
			expected:    []*LocalSource{},
		},
		{
			name:        "Directory with a symlink to a directory",
			pluginsPath: filepath.Join(testdataDir, "symbolic-plugin-dirs"),
			cfg:         &config.PluginManagementCfg{},
			expected: []*LocalSource{
				{
					paths:      []string{filepath.Join(testdataDir, "symbolic-plugin-dirs", "plugin")},
					class:      plugins.ClassExternal,
					strictMode: true,
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := DirAsLocalSources(tt.cfg, tt.pluginsPath, plugins.ClassExternal)
			if tt.err != nil {
				require.Errorf(t, err, tt.err.Error())
				return
			}
			require.NoError(t, err)
			if !cmp.Equal(got, tt.expected, compareOpts...) {
				t.Fatalf("Result mismatch (-want +got):\n%s", cmp.Diff(got, tt.expected, compareOpts...))
			}
		})
	}
}
