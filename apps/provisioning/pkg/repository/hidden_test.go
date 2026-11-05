package repository

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsIgnoredPath(t *testing.T) {
	for _, tt := range []struct {
		name    string
		path    string
		isDir   bool
		ignored bool
	}{
		{"root", "", true, false},
		{"visible file", "dashboard.json", false, false},
		{"visible directory", "team/", true, false},
		{"dot within directory name", "team.v2/dashboard.json", false, false},
		{"hidden file", ".config.json", false, true},
		{"nested hidden file", "team/.config.json", false, true},
		{"hidden directory", ".ci", true, true},
		{"hidden directory with trailing slash", ".ci/", true, true},
		{"file in hidden directory", ".ci/pipeline.yaml", false, true},
		{"directory in hidden directory", ".git/objects/", true, true},
		{"nested hidden directory", "team/.ci/config.json", false, true},
		{"hidden path with unsupported characters", "team/.hidden & config/_folder.json", false, true},
		{"root keep marker", ".keep", false, false},
		{"nested keep marker", "team/empty/.keep", false, false},
		{"keep marker in hidden directory", ".ci/.keep", false, true},
		{"keep marker under hidden ancestor", "team/.ci/empty/.keep", false, true},
		{"keep directory", ".keep", true, true},
		{"nested keep directory", "team/.keep/", true, true},
		{"file in keep directory", "team/.keep/dashboard.json", false, true},
		{"keep marker in keep directory", ".keep/.keep", false, true},
		{"keep prefix is not a marker", "team/.keep.json", false, true},
	} {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.ignored, IsIgnoredPath(tt.path, tt.isDir))
		})
	}
}
