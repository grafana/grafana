package resources

import (
	"errors"
	"fmt"
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
			name:        "markdown file not supported for write",
			path:        "dashboards/README.md",
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

func TestIsReadablePath(t *testing.T) {
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
			name: "valid markdown file",
			path: "dashboards/README.md",
		},
		{
			name: "markdown file in nested path",
			path: "dashboards/folder1/folder2/README.md",
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
			path:        "../dashboards/README.md",
			expectedErr: safepath.ErrPathTraversalAttempt,
		},
		{
			name:        "path too deep",
			path:        "level1/level2/level3/level4/level5/level6/level7/level8/level9/README.md",
			expectedErr: ErrPathTooDeep,
		},
		{
			name:        "absolute path",
			path:        "/etc/dashboards/README.md",
			expectedErr: ErrNotRelative,
		},
		{
			name: "empty directory path",
			path: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := IsReadablePath(tt.path)
			if tt.expectedErr != nil {
				require.ErrorIs(t, err, tt.expectedErr)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestIsRawFile(t *testing.T) {
	tests := []struct {
		name     string
		path     string
		expected bool
	}{
		{
			name:     "markdown file is raw",
			path:     "README.md",
			expected: true,
		},
		{
			name:     "nested markdown file is raw",
			path:     "dashboards/folder/README.md",
			expected: true,
		},
		{
			name:     "uppercase MD extension",
			path:     "README.MD",
			expected: true,
		},
		{
			name:     "yaml file is not raw",
			path:     "dashboard.yaml",
			expected: false,
		},
		{
			name:     "json file is not raw",
			path:     "dashboard.json",
			expected: false,
		},
		{
			name:     "yml file is not raw",
			path:     "dashboard.yml",
			expected: false,
		},
		{
			name:     "directory is not raw",
			path:     "dashboards/",
			expected: false,
		},
		{
			name:     "empty path is not raw",
			path:     "",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, IsRawFile(tt.path))
		})
	}
}

func TestUnsupportedPathError(t *testing.T) {
	cause := safepath.ErrInvalidCharacters
	err := &UnsupportedPathError{Path: "folder/Backend & UI.json", Err: cause}

	t.Run("message names the path and the cause", func(t *testing.T) {
		require.EqualError(t, err, `path "folder/Backend & UI.json" is not supported: `+cause.Error())
	})

	t.Run("unwraps to the cause", func(t *testing.T) {
		require.Equal(t, cause, err.Unwrap())
		require.ErrorIs(t, err, safepath.ErrInvalidCharacters)
		require.NotErrorIs(t, err, safepath.ErrHiddenPath)
	})

	t.Run("can be found again after being wrapped", func(t *testing.T) {
		wrapped := fmt.Errorf("applying change: %w", err)

		var got *UnsupportedPathError
		require.True(t, errors.As(wrapped, &got))
		require.Equal(t, "folder/Backend & UI.json", got.Path)
		require.ErrorIs(t, wrapped, safepath.ErrInvalidCharacters)
	})

	t.Run("is produced for what IsPathSupported rejects", func(t *testing.T) {
		pathErr := IsPathSupported("folder/Backend & UI.json")
		require.Error(t, pathErr)

		wrapped := &UnsupportedPathError{Path: "folder/Backend & UI.json", Err: pathErr}
		require.ErrorIs(t, wrapped, safepath.ErrInvalidCharacters)
	})
}

func TestHasResourceExtension(t *testing.T) {
	tests := []struct {
		path string
		want bool
	}{
		{path: "dashboards/a.json", want: true},
		{path: "dashboards/a.yaml", want: true},
		{path: "dashboards/a.yml", want: true},
		{path: "dashboards/A.JSON", want: true},
		{path: "dashboards/a & b.json", want: true},
		{path: "dashboards/../a.json", want: true},
		{path: "dashboards/README.md", want: false},
		{path: "dashboards/image.png", want: false},
		{path: "dashboards/.keep", want: false},
		{path: "dashboards/", want: false},
		{path: "dashboards/json", want: false},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			require.Equal(t, tt.want, HasResourceExtension(tt.path))
		})
	}
}
