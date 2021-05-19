package httpclientprovider

import (
	"fmt"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/setting"
)

var newProviderFunc = sdkhttpclient.NewProvider

// New creates a new HTTP client provider with pre-configured middlewares.
func New(cfg *setting.Cfg) httpclient.Provider {
	userAgent := fmt.Sprintf("Grafana/%s", cfg.BuildVersion)
	middlewares := []sdkhttpclient.Middleware{
		DataSourceMetricsMiddleware(),
		SetUserAgentMiddleware(userAgent),
		sdkhttpclient.BasicAuthenticationMiddleware(),
		sdkhttpclient.CustomHeadersMiddleware(),
	}

	if cfg.SigV4AuthEnabled {
		middlewares = append(middlewares, SigV4Middleware())
	}

	return newProviderFunc(sdkhttpclient.ProviderOptions{
		Middlewares: middlewares,
	})
}
