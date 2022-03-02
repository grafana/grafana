package filestorage

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFilestorageApi_Join(t *testing.T) {
	var tests = []struct {
		name     string
		parts    []string
		expected string
	}{
		{
			name:     "multiple parts",
			parts:    []string{"prefix", "p1", "p2"},
			expected: "/prefix/p1/p2",
		},
		{
			name:     "no parts",
			parts:    []string{},
			expected: "/",
		},
		{
			name:     "a single part",
			parts:    []string{"prefix"},
			expected: "/prefix",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, Join(tt.parts...))
		})
	}
}

func TestFilestorageApi_belongToStorage(t *testing.T) {
	var tests = []struct {
		name     string
		path     string
		storage  StorageName
		expected bool
	}{
		{
			name:     "should return true if path is prefixed with delimiter and the storage name",
			path:     "/public/abc/d",
			storage:  StorageNamePublic,
			expected: true,
		},
		{
			name:     "should return true if path consists just of the delimiter and the storage name",
			path:     "/public",
			storage:  StorageNamePublic,
			expected: true,
		},
		{
			name:     "should return false if path is not prefixed with delimiter",
			path:     "public/abc/d",
			storage:  StorageNamePublic,
			expected: false,
		},
		{
			name:     "should return false if storage name does not match",
			path:     "/notpublic/abc/d",
			storage:  StorageNamePublic,
			expected: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, belongsToStorage(tt.path, tt.storage))
		})
	}
}
