package safepath

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWalk(t *testing.T) {
	tests := []struct {
		name          string
		path          string
		expectedPaths []string
		expectError   bool
	}{
		{
			name: "simple path",
			path: "a/b/c",
			expectedPaths: []string{
				"a",
				"a/b",
				"a/b/c",
			},
		},
		{
			name: "path with leading slash",
			path: "/a/b/c",
			expectedPaths: []string{
				"a",
				"a/b",
				"a/b/c",
			},
		},
		{
			name: "path with trailing slash",
			path: "a/b/c/",
			expectedPaths: []string{
				"a",
				"a/b",
				"a/b/c",
			},
		},
		{
			name:          "root path",
			path:          "/",
			expectedPaths: nil,
		},
		{
			name:          "current directory",
			path:          ".",
			expectedPaths: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var paths []string
			err := Walk(context.Background(), tt.path, func(ctx context.Context, p string) error {
				paths = append(paths, p)
				return nil
			})

			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectedPaths, paths)
			}
		})
	}
}

func TestDepth(t *testing.T) {
	tests := []struct {
		name          string
		path          string
		expectedDepth int
	}{
		{
			name:          "empty path",
			path:          "",
			expectedDepth: 0,
		},
		{
			name:          "root path",
			path:          "/",
			expectedDepth: 0,
		},
		{
			name:          "single level",
			path:          "a",
			expectedDepth: 1,
		},
		{
			name:          "multiple levels",
			path:          "a/b/c",
			expectedDepth: 3,
		},
		{
			name:          "path with leading slash",
			path:          "/a/b/c",
			expectedDepth: 3,
		},
		{
			name:          "path with trailing slash",
			path:          "a/b/c/",
			expectedDepth: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			depth := Depth(tt.path)
			assert.Equal(t, tt.expectedDepth, depth)
		})
	}
}

func TestSplit(t *testing.T) {
	tests := []struct {
		name             string
		path             string
		expectedSegments []string
	}{
		{
			name:             "empty path",
			path:             "",
			expectedSegments: []string{},
		},
		{
			name:             "root path",
			path:             "/",
			expectedSegments: []string{},
		},
		{
			name:             "single segment",
			path:             "a",
			expectedSegments: []string{"a"},
		},
		{
			name:             "multiple segments",
			path:             "a/b/c",
			expectedSegments: []string{"a", "b", "c"},
		},
		{
			name:             "path with leading slash",
			path:             "/a/b/c",
			expectedSegments: []string{"a", "b", "c"},
		},
		{
			name:             "path with trailing slash",
			path:             "a/b/c/",
			expectedSegments: []string{"a", "b", "c"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			segments := Split(tt.path)
			assert.Equal(t, tt.expectedSegments, segments)
		})
	}
}

func TestWalkError(t *testing.T) {
	expectedErr := errors.New("test error")
	err := Walk(context.Background(), "a/b/c", func(ctx context.Context, p string) error {
		if p == "a/b" {
			return expectedErr
		}
		return nil
	})

	require.ErrorIs(t, err, expectedErr)
}
