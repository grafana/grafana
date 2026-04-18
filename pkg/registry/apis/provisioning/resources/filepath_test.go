package resources

import (
	"testing"

	"github.com/grafana/grafana/apps/provisioning/pkg/safepath"
	"github.com/stretchr/testify/require"
)

func TestIsPathSupported(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		expectedErr error
	}{
		{
			name: "valid yaml file",
			path: "dashboards/my-dashboard.yaml",
		},
		{
			name: "valid yml file",
			path: "dashboards/my-dashboard.yml",
		},
		{
			name: "valid json file",
			path: "dashboards/my-dashboard.json",
		},
		{
			name: "valid nested path",
			path: "dashboards/folder1/folder2/my-dashboard.yaml",
		},
		{
			name: "valid directory path",
			path: "dashboards/folder1/",
		},
		{
			name:        "unsupported file extension",
			path:        "dashboards/my-dashboard.txt",
			expectedErr: ErrUnsupportedFileExtension,
		},
		{
			name:        "path traversal attempt",
			path:        "../dashboards/my-dashboard.yaml",
			expectedErr: safepath.ErrPathTraversalAttempt,
		},
		{
			name:        "path too deep",
			path:        "level1/level2/level3/level4/level5/level6/level7/level8/level9/dashboard.yaml",
			expectedErr: ErrPathTooDeep,
		},
		{
			name:        "absolute path",
			path:        "/etc/dashboards/my-dashboard.yaml",
			expectedErr: ErrNotRelative,
		},
		{
			name: "empty directory path",
			path: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := IsPathSupported(tt.path)
			if tt.expectedErr != nil {
				require.ErrorIs(t, err, tt.expectedErr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
