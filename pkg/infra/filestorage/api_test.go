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
