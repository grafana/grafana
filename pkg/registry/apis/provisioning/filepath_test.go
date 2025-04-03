package provisioning

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPathAfterPrefix(t *testing.T) {
	tests := []struct {
		name        string
		urlPath     string
		prefix      string
		want        string
		expectError bool
	}{
		{
			name:        "basic path with prefix",
			urlPath:     "/a/b/prefix/c",
			prefix:      "/prefix",
			want:        "c",
			expectError: false,
		},
		{
			name:        "path with multiple prefix occurrences",
			urlPath:     "/a/prefix/b/prefix/c",
			prefix:      "/prefix",
			want:        "b/prefix/c",
			expectError: false,
		},
		{
			name:        "path without prefix",
			urlPath:     "/a/b/c",
			prefix:      "/prefix",
			want:        "",
			expectError: true,
		},
		{
			name:        "empty path",
			urlPath:     "",
			prefix:      "/prefix",
			want:        "",
			expectError: true,
		},
		{
			name:        "empty prefix",
			urlPath:     "/a/b/c/d",
			prefix:      "",
			want:        "a/b/c/d",
			expectError: false,
		},
		{
			name:        "prefix at start of path",
			urlPath:     "/prefix/rest/of/path",
			prefix:      "/prefix",
			want:        "rest/of/path",
			expectError: false,
		},
		{
			name:        "prefix in middle with special chars",
			urlPath:     "/a/b-c/prefix/d_e/f",
			prefix:      "/prefix",
			want:        "d_e/f",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := pathAfterPrefix(tt.urlPath, tt.prefix)
			if tt.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, tt.want, got)
			}
		})
	}
}
