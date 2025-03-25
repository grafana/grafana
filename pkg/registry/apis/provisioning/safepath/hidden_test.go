package safepath

import (
	"testing"
)

func TestNotHiddenPath(t *testing.T) {
	tests := []struct {
		name     string
		filePath string
		want     string
	}{
		{
			name:     "no hidden paths",
			filePath: "path/to/normal/file.txt",
			want:     "path/to/normal/file.txt",
		},
		{
			name:     "hidden file in middle",
			filePath: "path/to/.hidden/file.txt",
			want:     "path/to/",
		},
		{
			name:     "hidden file at start",
			filePath: ".hidden/path/file.txt",
			want:     "",
		},
		{
			name:     "multiple hidden paths",
			filePath: "path/.hidden/more/.secret/file.txt",
			want:     "path/",
		},
		{
			name:     "empty path",
			filePath: "",
			want:     "",
		},
		{
			name:     "single hidden file",
			filePath: ".gitignore",
			want:     "",
		},
		{
			name:     "path with trailing slash",
			filePath: "path/to/normal/",
			want:     "path/to/normal/",
		},
		{
			name:     "hidden path with trailing slash",
			filePath: "path/to/.hidden/",
			want:     "path/to/",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NotHiddenPath(tt.filePath)
			if got != tt.want {
				t.Errorf("NotHiddenPath(%q) = %q, want %q", tt.filePath, got, tt.want)
			}
		})
	}
}
