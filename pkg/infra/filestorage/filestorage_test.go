package filestorage

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFilestorage_removeStoragePrefix(t *testing.T) {
	var tests = []struct {
		name     string
		path     string
		expected string
	}{
		{
			name:     "should return root if path is empty",
			path:     "",
			expected: Delimiter,
		},
		{
			name:     "should remove prefix folder from path with multiple parts",
			path:     "public/abc/d",
			expected: "/abc/d",
		},
		{
			name:     "should return root path if path is just the storage name",
			path:     "public",
			expected: Delimiter,
		},
		{
			name:     "should return root path if path is the prefix of storage",
			path:     "public/",
			expected: Delimiter,
		},
	}
	for _, tt := range tests {
		t.Run(fmt.Sprintf("%s%s", "absolute: ", tt.name), func(t *testing.T) {
			require.Equal(t, tt.expected, removeStoragePrefix(Delimiter+tt.path))
		})

		t.Run(fmt.Sprintf("%s%s", "relative: ", tt.name), func(t *testing.T) {
			require.Equal(t, tt.expected, removeStoragePrefix(tt.path))
		})
	}
}
