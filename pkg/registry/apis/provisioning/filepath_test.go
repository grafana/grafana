package provisioning

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestExtractFilePath(t *testing.T) {
	tests := []struct {
		name        string
		urlPath     string
		prefix      string
		want        string
		wantErr     bool
		errContains string
	}{
		{
			name:    "empty path returns empty string",
			urlPath: "/repo/files/",
			prefix:  "/repo/files/",
			want:    "",
		},
		{
			name:    "valid json file path",
			urlPath: "/repo/files/folder/test.json",
			prefix:  "/repo/files/",
			want:    "folder/test.json",
		},
		{
			name:    "valid yaml file path",
			urlPath: "/repo/files/folder/test.yaml",
			prefix:  "/repo/files/",
			want:    "folder/test.yaml",
		},
		{
			name:    "valid yml file path",
			urlPath: "/repo/files/folder/test.yml",
			prefix:  "/repo/files/",
			want:    "folder/test.yml",
		},
		{
			name:    "valid folder path with trailing slash",
			urlPath: "/repo/files/folder/subfolder/",
			prefix:  "/repo/files/",
			want:    "folder/subfolder/",
		},
		{
			name:        "invalid file extension",
			urlPath:     "/repo/files/test.txt",
			prefix:      "/repo/files/",
			wantErr:     true,
			errContains: "only yaml and json files supported",
		},
		{
			name:        "invalid prefix",
			urlPath:     "/wrong/path/test.json",
			prefix:      "/repo/files/",
			wantErr:     true,
			errContains: "invalid request path",
		},
		{
			name:        "path is too deep",
			urlPath:     "/repo/files/a/b/c/d/e/f/g/h/file.json",
			prefix:      "/repo/files/",
			wantErr:     true,
			errContains: "path too deep",
		},
		{
			name:        "path is too long",
			urlPath:     "/repo/files/" + strings.Repeat("a", 1024) + ".json",
			prefix:      "/repo/files/",
			wantErr:     true,
			errContains: "path too long",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ExtractFilePath(tt.urlPath, tt.prefix)
			if tt.wantErr {
				require.Error(t, err)
				if tt.errContains != "" {
					require.Contains(t, err.Error(), tt.errContains)
				}
				return
			}
			require.NoError(t, err)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestIsFolderPath(t *testing.T) {
	tests := []struct {
		name     string
		filePath string
		want     bool
	}{
		{
			name:     "empty path",
			filePath: "",
			want:     false,
		},
		{
			name:     "file path without extension",
			filePath: "test",
			want:     false,
		},
		{
			name:     "file path with extension",
			filePath: "test.json",
			want:     false,
		},
		{
			name:     "folder path with trailing slash",
			filePath: "folder/",
			want:     true,
		},
		{
			name:     "nested folder path with trailing slash",
			filePath: "folder/subfolder/",
			want:     true,
		},
		{
			name:     "file path in folder without trailing slash",
			filePath: "folder/test.json",
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsFolderPath(tt.filePath)
			require.Equal(t, tt.want, got)
		})
	}
}
