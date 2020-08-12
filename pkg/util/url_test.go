package util

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestJoinURLFragments(t *testing.T) {
	t.Parallel()

	tests := []struct {
		description string
		base        string
		path        string
		expected    string
	}{
		{
			description: "RHS is empty",
			base:        "http://localhost:8080",
			path:        "",
			expected:    "http://localhost:8080",
		},
		{
			description: "RHS is empty and LHS has trailing slash",
			base:        "http://localhost:8080/",
			path:        "",
			expected:    "http://localhost:8080/",
		},
		{
			description: "neither has trailing slash",
			base:        "http://localhost:8080",
			path:        "api",
			expected:    "http://localhost:8080/api",
		},
		{
			description: "LHS has trailing slash",
			base:        "http://localhost:8080/",
			path:        "api",
			expected:    "http://localhost:8080/api",
		},
		{
			description: "LHS and RHS has trailing slash",
			base:        "http://localhost:8080/",
			path:        "api/",
			expected:    "http://localhost:8080/api/",
		},
		{
			description: "LHS has trailing slash and RHS has preceding slash",
			base:        "http://localhost:8080/",
			path:        "/api/",
			expected:    "http://localhost:8080/api/",
		},
	}
	for _, testcase := range tests {
		t.Run("where "+testcase.description, func(t *testing.T) {
			assert.Equalf(
				t,
				testcase.expected,
				JoinURLFragments(testcase.base, testcase.path),
				"base: '%s', path: '%s'",
				testcase.base,
				testcase.path,
			)
		})
	}
}

func TestNewURLQueryReader(t *testing.T) {
	u, err := url.Parse("http://www.abc.com/foo?bar=baz&bar2=baz2")
	require.NoError(t, err)

	uqr, err := NewURLQueryReader(u)
	require.NoError(t, err)

	assert.Equal(t, "baz", uqr.Get("bar", "foodef"), "first param")
	assert.Equal(t, "baz2", uqr.Get("bar2", "foodef"), "second param")
	assert.Equal(t, "foodef", uqr.Get("bar3", "foodef"), "non-existing param, use fallback")
}
