package azuremonitor

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/deprecated"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/types"
	"github.com/stretchr/testify/require"
)

func Test_httpCliProvider(t *testing.T) {
	cfg := &setting.Cfg{}
	tests := []struct {
		name                string
		route               types.AzRoute
		model               types.DatasourceInfo
		expectedMiddlewares int
		Err                 require.ErrorAssertionFunc
	}{
		{
			name: "creates an HTTP client with a middleware due to the scope",
			route: types.AzRoute{
				URL:    "http://route",
				Scopes: []string{"http://route/.default"},
			},
			model: types.DatasourceInfo{
				Credentials: &azcredentials.AzureClientSecretCredentials{},
			},
			expectedMiddlewares: 1,
			Err:                 require.NoError,
		},
		{
			name: "creates an HTTP client with a middleware due to an app key",
			route: types.AzRoute{
				URL:    deprecated.AzAppInsights.URL,
				Scopes: []string{},
			},
			model: types.DatasourceInfo{
				Credentials: &azcredentials.AzureClientSecretCredentials{},
				DecryptedSecureJSONData: map[string]string{
					"appInsightsApiKey": "foo",
				},
			},
			expectedMiddlewares: 1,
			Err:                 require.NoError,
		},
		{
			name: "creates an HTTP client without a middleware",
			route: types.AzRoute{
				URL:    "http://route",
				Scopes: []string{},
			},
			model: types.DatasourceInfo{
				Credentials: &azcredentials.AzureClientSecretCredentials{},
			},
			expectedMiddlewares: 0,
			Err:                 require.NoError,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			m, err := getMiddlewares(tt.route, tt.model, cfg)
			require.NoError(t, err)

			// Cannot test that the cli middleware works properly since the azcore sdk
			// rejects the TLS certs (if provided)
			if len(m) != tt.expectedMiddlewares {
				t.Errorf("Unexpected middlewares: %v", m)
			}
		})
	}
}
