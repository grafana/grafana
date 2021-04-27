package httpclientprovider

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/setting"
)

// New creates a new HTTP client provider with pre-configured middlewares.
func New(cfg *setting.Cfg) httpclient.Provider {
	middlewares := []httpclient.Middleware{
		DataSourceMetricsMiddleware(),
		httpclient.BasicAuthenticationMiddleware(),
		httpclient.CustomHeadersMiddleware(),
	}

	if cfg.SigV4AuthEnabled {
		middlewares = append(middlewares, SigV4Middleware())
	}

	return httpclient.NewProvider(httpclient.ProviderOptions{
		Middlewares: middlewares,
	})
}
