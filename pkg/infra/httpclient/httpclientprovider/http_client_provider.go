package httpclientprovider

import (
	"net/http"
	"time"

	"github.com/grafana/grafana-aws-sdk/pkg/awsauth"
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
func New(cfg *setting.Cfg, validator validations.DataSourceRequestURLValidator, tracer tracing.Tracer) *sdkhttpclient.Provider {
	logger := log.New("httpclient")

	middlewares := []sdkhttpclient.Middleware{
		TracingMiddleware(logger, tracer),
		DataSourceMetricsMiddleware(),
		sdkhttpclient.ContextualMiddleware(),
		SetUserAgentMiddleware(cfg.DataProxy.UserAgent),
		sdkhttpclient.BasicAuthenticationMiddleware(),
		sdkhttpclient.CustomHeadersMiddleware(),
		sdkhttpclient.ResponseLimitMiddleware(cfg.DataProxy.ResponseLimit),
		RedirectLimitMiddleware(validator),
	}

	if httpLoggingEnabled(cfg.PluginSettings) {
		middlewares = append(middlewares, HTTPLoggerMiddleware(cfg.PluginSettings))
	}

	if cfg.IPRangeACEnabled {
		middlewares = append(middlewares, GrafanaRequestIDHeaderMiddleware(cfg, logger))
	}

	middlewares = append(middlewares, sdkhttpclient.ErrorSourceMiddleware())

	// SigV4 signing should be performed after all headers are added
	if cfg.SigV4AuthEnabled {
		middlewares = append(middlewares, awsauth.NewSigV4Middleware())
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

// newConntrackRoundTripper takes a http.Transport and adds the Conntrack Dialer
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
		Timeout:               time.Duration(cfg.DataProxy.Timeout) * time.Second,
		DialTimeout:           time.Duration(cfg.DataProxy.DialTimeout) * time.Second,
		KeepAlive:             time.Duration(cfg.DataProxy.KeepAlive) * time.Second,
		TLSHandshakeTimeout:   time.Duration(cfg.DataProxy.TLSHandshakeTimeout) * time.Second,
		ExpectContinueTimeout: time.Duration(cfg.DataProxy.ExpectContinueTimeout) * time.Second,
		MaxConnsPerHost:       cfg.DataProxy.MaxConnsPerHost,
		MaxIdleConns:          cfg.DataProxy.MaxIdleConns,
		MaxIdleConnsPerHost:   cfg.DataProxy.MaxIdleConns,
		IdleConnTimeout:       time.Duration(cfg.DataProxy.IdleConnTimeout) * time.Second,
	}
}
