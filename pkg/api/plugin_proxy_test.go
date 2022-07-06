package api

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExtractPluginProxyPath(t *testing.T) {
	testCases := []struct {
		originalRawPath string
		exp             string
	}{
		{
			"/api/plugin-proxy/test",
			"",
		},
		{
			"/api/plugin-proxy/test/some/thing",
			"some/thing",
		},
		{
			"/api/plugin-proxy/test2/api/services/afsd%2Fafsd/operations",
			"api/services/afsd%2Fafsd/operations",
		},
	}
	for _, tc := range testCases {
		t.Run("Given raw path, should extract expected proxy path", func(t *testing.T) {
			assert.Equal(t, tc.exp, extractProxyPath(tc.originalRawPath))
		})
	}
}
