package httpclientprovider

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics/metricutil"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/mwitkow/go-conntrack"
	"golang.org/x/net/proxy"
)

var newProviderFunc = sdkhttpclient.NewProvider

// New creates a new HTTP client provider with pre-configured middlewares.
func New(cfg *setting.Cfg, validator models.PluginRequestValidator, tracer tracing.Tracer) *sdkhttpclient.Provider {
	logger := log.New("httpclient")
	userAgent := fmt.Sprintf("Grafana/%s", cfg.BuildVersion)

	middlewares := []sdkhttpclient.Middleware{
		TracingMiddleware(logger, tracer),
		DataSourceMetricsMiddleware(),
		SetUserAgentMiddleware(userAgent),
		sdkhttpclient.BasicAuthenticationMiddleware(),
		sdkhttpclient.CustomHeadersMiddleware(),
		sdkhttpclient.ContextualMiddleware(),
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

			_, enableSocksProxy := opts.CustomOptions["socks_proxy"]
			if cfg.IsFeatureToggleEnabled(featuremgmt.FlagSecureSocksDatasourceProxy) && enableSocksProxy {
				err = newSecureSocksProxy(cfg, transport)
				if err != nil {
					logger.Error("Failed to enable the socks proxy", "error", err.Error(), "datasource", datasourceName)
				}
			}

			newConntrackRoundTripper(datasourceLabelName, transport)
		},
	})
}

// newSecureSocksProxy takes a http.DefaultTransport and wraps it in a socks5 proxy with TLS
func newSecureSocksProxy(cfg *setting.Cfg, transport *http.Transport) error {
	// all fields must be specified to use the proxy
	if cfg.SecureSocksDSProxy.RootCA == "" {
		return errors.New("missing rootCA")
	} else if cfg.SecureSocksDSProxy.ClientCert == "" || cfg.SecureSocksDSProxy.ClientKey == "" {
		return errors.New("missing client key pair")
	} else if cfg.SecureSocksDSProxy.ServerName == "" {
		return errors.New("missing server name")
	} else if cfg.SecureSocksDSProxy.ProxyAddress == "" {
		return errors.New("missing proxy address")
	}

	certPool := x509.NewCertPool()
	for _, rootCAFile := range strings.Split(cfg.SecureSocksDSProxy.RootCA, " ") {
		// nolint:gosec
		// The gosec G304 warning can be ignored because `rootCAFile` comes from config ini.
		pem, err := os.ReadFile(rootCAFile)
		if err != nil {
			return err
		}
		if !certPool.AppendCertsFromPEM(pem) {
			return errors.New("failed to append CA certificate " + rootCAFile)
		}
	}

	cert, err := tls.LoadX509KeyPair(cfg.SecureSocksDSProxy.ClientCert, cfg.SecureSocksDSProxy.ClientKey)
	if err != nil {
		return err
	}

	tlsDialer := &tls.Dialer{
		Config: &tls.Config{
			Certificates: []tls.Certificate{cert},
			ServerName:   cfg.SecureSocksDSProxy.ServerName,
			RootCAs:      certPool,
		},
	}
	dialSocksProxy, err := proxy.SOCKS5("tcp", cfg.SecureSocksDSProxy.ProxyAddress, nil, tlsDialer)
	if err != nil {
		return err
	}

	contextDialer, ok := dialSocksProxy.(proxy.ContextDialer)
	if !ok {
		return errors.New("unable to cast socks proxy dialer to context proxy dialer")
	}

	transport.DialContext = contextDialer.DialContext

	return nil
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
