package middleware

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestMatchesAllowedPath(t *testing.T) {
	tests := []struct {
		name      string
		aPath     string
		allowList string
		matches   bool
	}{
		{
			name:      "single url with match",
			allowList: "/api/plugins/*",
			aPath:     "/api/plugins/my-plugin",
			matches:   true,
		},
		{
			name:      "single url no match",
			allowList: "/api/plugins/*",
			aPath:     "/api/plugin/my-plugin",
			matches:   false,
		},
		{
			name:      "multiple urls with match",
			allowList: "/api/plugins/*, /api/other/**",
			aPath:     "/api/other/my-plugin",
			matches:   true,
		},
		{
			name:      "multiple urls no match",
			allowList: "/api/plugins/*, /api/other/**",
			aPath:     "/api/misc/my-plugin",
			matches:   false,
		},
	}

	for _, tc := range tests {
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			allGlobs, err := cacheGlobs(tc.allowList)
			matched := matchesAllowedPath(allGlobs, tc.aPath)
			assert.NoError(t, err)
			assert.Equal(t, matched, tc.matches)
		})
	}
}

func TestCacheGlobs(t *testing.T) {
	tests := []struct {
		name           string
		allowList      string
		expectedLength int
	}{
		{
			name:           "single url",
			allowList:      "/api/plugins",
			expectedLength: 1,
		},
		{
			name:           "multiple urls",
			allowList:      "/api/plugins, /api/other/**",
			expectedLength: 2,
		},
	}

	for _, tc := range tests {
		tc := tc

		t.Run(tc.name, func(t *testing.T) {
			cache, err := cacheGlobs(tc.allowList)
			assert.NoError(t, err)
			assert.Equal(t, len(*cache), tc.expectedLength)
		})
	}
}
