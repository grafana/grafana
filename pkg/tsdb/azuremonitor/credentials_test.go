package azuremonitor

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func Test_httpCliProvider(t *testing.T) {
	ctx := context.TODO()
	cfg := &setting.Cfg{}
	model := datasourceInfo{
		Settings:                azureMonitorSettings{},
		DecryptedSecureJSONData: map[string]string{"clientSecret": "content"},
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
			cli := httpClientProvider(ctx, tt.route, model, cfg)
			// Cannot test that the cli middleware works properly since the azcore sdk
			// rejects the TLS certs (if provided)
			if len(cli.Opts.Middlewares) != tt.expectedMiddlewares {
				t.Errorf("Unexpected middlewares: %v", cli.Opts.Middlewares)
			}
		})
	}
}
