package util

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestUrl(t *testing.T) {
	tests := []struct {
		base     string
		path     string
		expected string
	}{
		{base: "http://localhost:8080", path: "", expected: "http://localhost:8080"},
		{base: "http://localhost:8080/", path: "", expected: "http://localhost:8080/"},
		{base: "http://localhost:8080", path: "api", expected: "http://localhost:8080/api"},
		{base: "http://localhost:8080/", path: "api", expected: "http://localhost:8080/api"},
		{base: "http://localhost:8080/", path: "api/", expected: "http://localhost:8080/api/"},
		{base: "http://localhost:8080/", path: "/api/", expected: "http://localhost:8080/api/"},
	}
	for _, testcase := range tests {
		assert.Equalf(
			t,
			testcase.expected,
			JoinURLFragments(testcase.base, testcase.path),
			"base: '%s', path: '%s'",
			testcase.base,
			testcase.path,
		)
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
