package features

import (
	"fmt"
	"net/http"
	"time"

	authlib "github.com/grafana/authlib/authn"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const (
	// FeaturesProviderAudience is the default audience for Grafana features service
	FeaturesProviderAudience = "features.grafana.app"
)

// HTTPClientOptions contains options for creating an HTTP client
type HTTPClientOptions struct {
	// Timeout for HTTP requests
	Timeout time.Duration
	// InsecureSkipVerify skips TLS certificate verification (use with caution)
	InsecureSkipVerify bool
	// Middlewares to apply to the HTTP client
	Middlewares []sdkhttpclient.Middleware
}

// CreateHTTPClient creates a plain HTTP client without authentication.
// Use this for unauthenticated OFREP providers or when you don't need token exchange.
func CreateHTTPClient(opts HTTPClientOptions) (*http.Client, error) {
	timeout := opts.Timeout
	if timeout == 0 {
		timeout = 10 * time.Second
	}

	options := sdkhttpclient.Options{
		TLS: &sdkhttpclient.TLSOptions{
			InsecureSkipVerify: opts.InsecureSkipVerify,
		},
		Timeouts: &sdkhttpclient.TimeoutOptions{
			Timeout: timeout,
		},
		Middlewares: opts.Middlewares,
	}

	httpcli, err := sdkhttpclient.NewProvider().New(options)
	if err != nil {
		return nil, fmt.Errorf("failed to create http client for openfeature: %w", err)
	}

	return httpcli, nil
}

// CreateHTTPClientWithTokenExchange creates an authenticated HTTP client with token exchange
// in a single call. This is a convenience function that combines NewTokenExchangeMiddleware
// and HTTP client creation.
//
// The namespace parameter specifies the token exchange namespace:
//   - Use a specific namespace (e.g., "stack-123") for single-tenant services
//   - Use "*" for multi-tenant services that work across multiple namespaces
func CreateHTTPClientWithTokenExchange(
	tokenExchanger authlib.TokenExchanger,
	namespace string,
	audiences []string,
	opts HTTPClientOptions,
) (*http.Client, error) {
	middleware := NewTokenExchangeMiddleware(tokenExchanger, namespace)
	opts.Middlewares = append(opts.Middlewares, middleware.new(audiences))
	return CreateHTTPClient(opts)
}
