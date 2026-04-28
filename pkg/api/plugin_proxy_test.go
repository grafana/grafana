package api

import (
	"net/http"
	"net/url"
	"testing"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
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
		{
			"/api/plugin-proxy/cloudflare-app/with-token/api/v4/accounts",
			"with-token/api/v4/accounts",
		},
		{
			"/api/plugin-proxy/cloudflare-app/with-token/api/v4/accounts/",
			"with-token/api/v4/accounts/",
		},
	}
	for _, tc := range testCases {
		t.Run("Given raw path, should extract expected proxy path", func(t *testing.T) {
			assert.Equal(t, tc.exp, extractProxyPath(tc.originalRawPath))
		})
	}
}

func TestGetProxyPath(t *testing.T) {
	testCases := []struct {
		rawPath string
		exp     string
	}{
		{
			"/api/plugin-proxy/test",
			"/",
		},
		{
			"/api/plugin-proxy/test/some/thing",
			"/some/thing",
		},
		{
			"/api/plugin-proxy/test2/api/services/afsd%2Fafsd/operations",
			"/api/services/afsd%2Fafsd/operations",
		},
		{
			"/api/plugin-proxy/cloudflare-app/with-token/api/v4/accounts",
			"/with-token/api/v4/accounts",
		},
	}
	for _, tc := range testCases {
		t.Run("Given raw path, getProxyPath should normalize with leading slash", func(t *testing.T) {
			c := &contextmodel.ReqContext{
				Context: &contextmodel.Context{
					Req: &http.Request{
						URL: &url.URL{RawPath: tc.rawPath},
					},
				},
			}
			assert.Equal(t, tc.exp, getProxyPath(c))
		})
	}
}