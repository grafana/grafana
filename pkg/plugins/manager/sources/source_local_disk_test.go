package sources

import (
	"errors"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
)

func TestDirAsLocalSources(t *testing.T) {
	testdataDir := "../testdata"

	tests := []struct {
		name        string
		pluginsPath string
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
			expected: []*LocalSource{
				{
					paths: []string{filepath.Join(testdataDir, "pluginRootWithDist", "datasource")},
					class: plugins.ClassExternal,
				},
				{
					paths: []string{filepath.Join(testdataDir, "pluginRootWithDist", "dist")},
					class: plugins.ClassExternal,
				},
				{
					paths: []string{filepath.Join(testdataDir, "pluginRootWithDist", "panel")},
					class: plugins.ClassExternal,
				},
			},
		},
		{
			name:        "Directory with no subdirectories",
			pluginsPath: filepath.Join(testdataDir, "pluginRootWithDist", "datasource"),
			expected:    []*LocalSource{},
		},
		{
			name:        "Directory with a symlink to a directory",
			pluginsPath: filepath.Join(testdataDir, "symbolic-plugin-dirs"),
			expected: []*LocalSource{
				{
					paths: []string{filepath.Join(testdataDir, "symbolic-plugin-dirs", "plugin")},
					class: plugins.ClassExternal,
				},
			},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := DirAsLocalSources(tt.pluginsPath, plugins.ClassExternal)
			if tt.err != nil {
				require.Errorf(t, err, tt.err.Error())
			}
			require.Equal(t, tt.expected, got)
		})
	}
}
