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
		name string
		Err  require.ErrorAssertionFunc
	}{
		{name: "creates an HTTP client", Err: require.NoError},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cli := httpCliProvider(ctx, azRoute{}, model, cfg)
			// Cannot test that the cli middleware works properly since the azcore sdk
			// rejects the TLS certs (if provided)
			if len(cli.Opts.Middlewares) != 1 {
				t.Errorf("Unexpected middlewares: %v", cli.Opts.Middlewares)
			}
		})
	}
}
