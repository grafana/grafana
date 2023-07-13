package httpclientprovider

import (
	"net/http"
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/mwitkow/go-conntrack"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
)

var newProviderFunc = sdkhttpclient.NewProvider

// New creates a new HTTP client provider with pre-configured middlewares.
func New(cfg *setting.Cfg, validator validations.PluginRequestValidator, tracer tracing.Tracer) *sdkhttpclient.Provider {
	logger := log.New("httpclient")

	middlewares := []sdkhttpclient.Middleware{
		TracingMiddleware(logger, tracer),
		DataSourceMetricsMiddleware(),
		sdkhttpclient.ContextualMiddleware(),
		SetUserAgentMiddleware(cfg.DataProxyUserAgent),
		sdkhttpclient.BasicAuthenticationMiddleware(),
		sdkhttpclient.CustomHeadersMiddleware(),
		ResponseLimitMiddleware(cfg.ResponseLimit),
		RedirectLimitMiddleware(validator),
	}

	if cfg.SigV4AuthEnabled {
		middlewares = append(middlewares, SigV4Middleware(cfg.SigV4VerboseLogging))
	}

	if httpLoggingEnabled(cfg.PluginSettings) {
		middlewares = append(middlewares, HTTPLoggerMiddleware(cfg.PluginSettings))
	}

	setDefaultTimeoutOptions(cfg)

	return newProviderFunc(sdkhttpclient.ProviderOptions{
		Middlewares: middlewares,
		ConfigureTransport: func(opts sdkhttpclient.Options, transport *http.Transport) {
			datasourceName, exists := opts.Labels["datasource_name"]
			if !exists {
				return
			}
			datasourceLabelName, err := metricutil.SanitizeLabelName(datasourceName)
			if err != nil {
				return
			}

			newConntrackRoundTripper(datasourceLabelName, transport)
		},
	})
}

// newConntrackRoundTripper takes a http.DefaultTransport and adds the Conntrack Dialer
// so we can instrument outbound connections
func newConntrackRoundTripper(name string, transport *http.Transport) *http.Transport {
	transport.DialContext = conntrack.NewDialContextFunc(
		conntrack.DialWithName(name),
		conntrack.DialWithDialContextFunc(transport.DialContext),
	)
	return transport
}

// setDefaultTimeoutOptions overrides the default timeout options for the SDK.
//
// Note: Not optimal changing global state, but hard to not do in this case.
func setDefaultTimeoutOptions(cfg *setting.Cfg) {
	sdkhttpclient.DefaultTimeoutOptions = sdkhttpclient.TimeoutOptions{
		Timeout:               time.Duration(cfg.DataProxyTimeout) * time.Second,
		DialTimeout:           time.Duration(cfg.DataProxyDialTimeout) * time.Second,
		KeepAlive:             time.Duration(cfg.DataProxyKeepAlive) * time.Second,
		TLSHandshakeTimeout:   time.Duration(cfg.DataProxyTLSHandshakeTimeout) * time.Second,
		ExpectContinueTimeout: time.Duration(cfg.DataProxyExpectContinueTimeout) * time.Second,
		MaxConnsPerHost:       cfg.DataProxyMaxConnsPerHost,
		MaxIdleConns:          cfg.DataProxyMaxIdleConns,
		MaxIdleConnsPerHost:   cfg.DataProxyMaxIdleConns,
		IdleConnTimeout:       time.Duration(cfg.DataProxyIdleConnTimeout) * time.Second,
	}
}
