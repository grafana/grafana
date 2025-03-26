package safepath

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsFolderPath(t *testing.T) {
	tests := []struct {
		name     string
		filePath string
		want     bool
	}{
		{
			name:     "empty path",
			filePath: "",
			want:     true,
		},
		{
			name:     "dot path",
			filePath: ".",
			want:     true,
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
			got := IsDir(tt.filePath)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestDir(t *testing.T) {
	tests := []struct {
		name     string
		filePath string
		want     string
	}{
		{
			name:     "empty path",
			filePath: "",
			want:     "",
		},
		{
			name:     "root path",
			filePath: "/",
			want:     "",
		},
		{
			name:     "single directory",
			filePath: "folder",
			want:     "",
		},
		{
			name:     "nested directory",
			filePath: "folder/subfolder",
			want:     "folder/",
		},
		{
			name:     "file in directory",
			filePath: "folder/file.txt",
			want:     "folder/",
		},
		{
			name:     "multiple nested directories",
			filePath: "folder/subfolder/subsubfolder",
			want:     "folder/subfolder/",
		},
		{
			name:     "directory with trailing slash",
			filePath: "folder/subfolder/",
			want:     "folder/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Dir(tt.filePath)
			require.Equal(t, tt.want, got)
		})
	}
}

func TestInDir(t *testing.T) {
	tests := []struct {
		name     string
		filePath string
		dir      string
		want     bool
	}{
		{
			name:     "file in directory",
			filePath: "folder/file.txt",
			dir:      "folder/",
			want:     true,
		},
		{
			name:     "file not in directory",
			filePath: "other/file.txt",
			dir:      "folder/",
			want:     false,
		},
		{
			name:     "subdirectory",
			filePath: "folder/subfolder/",
			dir:      "folder/",
			want:     true,
		},
		{
			name:     "empty directory",
			filePath: "folder/file.txt",
			dir:      "",
			want:     true,
		},
		{
			name:     "exact match",
			filePath: "folder/",
			dir:      "folder/",
			want:     true,
		},
		{
			name:     "partial directory name match",
			filePath: "folder2/file.txt",
			dir:      "folder/",
			want:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := InDir(tt.filePath, tt.dir)
			require.Equal(t, tt.want, got)
		})
	}
}
