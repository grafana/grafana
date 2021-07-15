package azuremonitor

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/azuremonitor/azcredentials"
	"github.com/stretchr/testify/require"
)

func Test_httpCliProvider(t *testing.T) {
	cfg := &setting.Cfg{}
	model := datasourceInfo{
		Credentials: &azcredentials.AzureClientSecretCredentials{},
	}
	tests := []struct {
		name                string
		route               azRoute
		expectedMiddlewares int
		Err                 require.ErrorAssertionFunc
	}{
		{
			name: "creates an HTTP client with a middleware",
			route: azRoute{
				URL:    "http://route",
				Scopes: []string{"http://route/.default"},
			},
			expectedMiddlewares: 1,
			Err:                 require.NoError,
		},
		{
			name: "creates an HTTP client without a middleware",
			route: azRoute{
				URL:    "http://route",
				Scopes: []string{},
			},
			// httpclient.NewProvider returns a client with 2 middlewares by default
			expectedMiddlewares: 2,
			Err:                 require.NoError,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cli, err := httpClientProvider(tt.route, model, cfg)
			require.NoError(t, err)

			// Cannot test that the cli middleware works properly since the azcore sdk
			// rejects the TLS certs (if provided)
			if len(cli.Opts.Middlewares) != tt.expectedMiddlewares {
				t.Errorf("Unexpected middlewares: %v", cli.Opts.Middlewares)
			}
		})
	}
}
