package datasourceproxy

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestDataProxy(t *testing.T) {
	t.Run("extractProxyPath", func(t *testing.T) {
		testCases := []struct {
			originalRawPath string
			exp             string
		}{
			{
				"/api/datasources/proxy/1",
				"",
			},
			{
				"/api/datasources/proxy/1/some/thing",
				"some/thing",
			},
			{
				"/api/datasources/proxy/54/api/services/afsd%2Fafsd/operations",
				"api/services/afsd%2Fafsd/operations",
			},
			{
				"/api/datasources/proxy/uid/26MI0wZ7k",
				"",
			},
			{
				"/api/datasources/proxy/uid/26MI0wZ7k/some/thing",
				"some/thing",
			},
			{
				"/api/datasources/proxy/uid/pUWo-no4k/search",
				"search",
			},
			{
				"/api/datasources/proxy/uid/pUWo_no4k/search",
				"search",
			},
			{
				"/api/datasources/proxy/uid/26MI0wZ7k/api/services/afsd%2Fafsd/operations",
				"api/services/afsd%2Fafsd/operations",
			},
		}
		for _, tc := range testCases {
			t.Run("Given raw path, should extract expected proxy path", func(t *testing.T) {
				assert.Equal(t, tc.exp, extractProxyPath(tc.originalRawPath))
			})
		}
	})
}
