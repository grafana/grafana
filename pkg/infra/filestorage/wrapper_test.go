package filestorage

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFilestorage_getParentFolderPath(t *testing.T) {
	var tests = []struct {
		name     string
		path     string
		expected string
	}{
		{
			name:     "should return empty path if path has a single part - relative, suffix",
			path:     "ab/",
			expected: "",
		},
		{
			name:     "should return empty path if path has a single part - relative, no suffix",
			path:     "ab",
			expected: "",
		},
		{
			name:     "should return root if path has a single part - abs, no suffix",
			path:     "/public",
			expected: Delimiter,
		},
		{
			name:     "should return root if path has a single part - abs, suffix",
			path:     "/public/",
			expected: Delimiter,
		},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf(tt.name), func(t *testing.T) {
			require.Equal(t, tt.expected, getParentFolderPath(tt.path))
		})
	}
}
