package api

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDataProxy(t *testing.T) {
	testCases := []struct {
		desc      string
		origPath  string
		proxyPath string
		exp       string
	}{
		{
			"Should append trailing slash to proxy path if original path has a trailing slash",
			"/api/datasources/proxy/6/api/v1/query_range/",
			"api/v1/query_range/",
			"api/v1/query_range/",
		},
		{
			"Should not append trailing slash to proxy path if original path doesn't have a trailing slash",
			"/api/datasources/proxy/6/api/v1/query_range",
			"api/v1/query_range",
			"api/v1/query_range",
		},
	}
	for _, tc := range testCases {
		t.Run(tc.desc, func(t *testing.T) {
			assert.Equal(t, tc.exp, ensureProxyPathTrailingSlash(tc.origPath, tc.proxyPath))
		})
	}
}
