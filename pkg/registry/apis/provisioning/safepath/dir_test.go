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
