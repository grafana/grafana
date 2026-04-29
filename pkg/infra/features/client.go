package features

import (
	"fmt"
	"net/http"
	"time"

	authlib "github.com/grafana/authlib/authn"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

const (
	// FeaturesProviderAudience is the default audience for Feature Flag service
	FeaturesProviderAudience = "features.grafana.app"
)

// HTTPClientOptions contains options for creating an HTTP client
type HTTPClientOptions struct {
	// Timeout for HTTP requests
	Timeout time.Duration
	// DialTimeout limits TCP connection establishment, separate from the full request Timeout.
	// Useful to fail fast when the provider is unreachable at network level. If unset, the SDK default applies.
	// For recurring outages, worth considering implementing a circuit breaker pattern.
	DialTimeout time.Duration
	// InsecureSkipVerify skips TLS certificate verification
	InsecureSkipVerify bool
	// RootCACertificate is a PEM certificate that verifies the server.
	RootCACertificate string
	// Middlewares to apply to the HTTP client
	Middlewares []sdkhttpclient.Middleware
	// CacheTTL enables response caching with the given TTL. Zero disables caching.
	CacheTTL time.Duration
}

// TokenExchangeConfig holds all authentication configuration for token exchange.
// The namespace specifies the identity scope for token exchange (e.g., "stack-123").
// Use "*" for multi-tenant services that operate across multiple namespaces.
// Note: This controls authentication scope, not which features can be evaluated.
type TokenExchangeConfig struct {
	TokenExchanger authlib.TokenExchanger
	Namespace      string   // Identity scope for token exchange
	Audiences      []string // Token audiences (e.g., []string{FeaturesProviderAudience})
}

// CreateHTTPClient creates a plain HTTP client without authentication.
func CreateHTTPClient(opts HTTPClientOptions) (*http.Client, error) {
	timeout := opts.Timeout
	if timeout == 0 {
		timeout = 10 * time.Second
	}

	middlewares := opts.Middlewares
	if opts.CacheTTL > 0 {
		middlewares = append([]sdkhttpclient.Middleware{newCacheMiddleware(opts.CacheTTL)}, middlewares...)
	}

	tlsOptions := &sdkhttpclient.TLSOptions{
		InsecureSkipVerify: opts.InsecureSkipVerify,
		CACertificate:      opts.RootCACertificate,
	}

	options := sdkhttpclient.Options{
		TLS: tlsOptions,
		Timeouts: &sdkhttpclient.TimeoutOptions{
			DialTimeout: opts.DialTimeout,
			Timeout:     timeout,
		},
		Middlewares: middlewares,
	}

	httpcli, err := sdkhttpclient.NewProvider().New(options)
	if err != nil {
		return nil, fmt.Errorf("failed to create http client for openfeature: %w", err)
	}

	return httpcli, nil
}

type tokenExchangeMiddlewareImpl struct {
	tokenExchangeClient authlib.TokenExchanger
	namespace           string
	audiences           []string
	next                http.RoundTripper
}

var _ http.RoundTripper = &tokenExchangeMiddlewareImpl{}

// RoundTrip implements http.RoundTripper by exchanging tokens before making the request.
func (m *tokenExchangeMiddlewareImpl) RoundTrip(req *http.Request) (*http.Response, error) {
	token, err := m.tokenExchangeClient.Exchange(req.Context(), authlib.TokenExchangeRequest{
		Namespace: m.namespace,
		Audiences: m.audiences,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to exchange token: %w", err)
	}

	req.Header.Set("X-Access-Token", "Bearer "+token.Token)
	return m.next.RoundTrip(req)
}

// createTokenExchangeMiddleware creates the token exchange middleware from config.
func createTokenExchangeMiddleware(config TokenExchangeConfig) sdkhttpclient.Middleware {
	// Return a MiddlewareFunc which implements the Middleware interface
	return sdkhttpclient.MiddlewareFunc(func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return &tokenExchangeMiddlewareImpl{
			tokenExchangeClient: config.TokenExchanger,
			namespace:           config.Namespace,
			audiences:           config.Audiences,
			next:                next,
		}
	})
}

// CreateAuthenticatedHTTPClient creates an HTTP client with token exchange authentication.
// Use this client to connect to Feature Flag service
func CreateAuthenticatedHTTPClient(
	authConfig TokenExchangeConfig,
	opts HTTPClientOptions,
) (*http.Client, error) {
	if authConfig.TokenExchanger == nil {
		return nil, fmt.Errorf("token exchanger is required")
	}

	// Create middleware with all auth config
	middleware := createTokenExchangeMiddleware(authConfig)
	opts.Middlewares = append(opts.Middlewares, middleware)
	return CreateHTTPClient(opts)
}

// CreateHTTPClientForProvider creates an HTTP client based on provider type.
// For FeaturesService: uses authConfig for token exchange authentication.
// For other OFREP providers that don't require authentication: creates plain HTTP client (authConfig can be nil).
func CreateHTTPClientForProvider(
	providerType OpenFeatureProviderType,
	authConfig *TokenExchangeConfig,
	opts HTTPClientOptions,
) (*http.Client, error) {
	if providerType == FeaturesServiceProviderType {
		if authConfig == nil {
			return nil, fmt.Errorf("auth config required for FeaturesService provider")
		}
		return CreateAuthenticatedHTTPClient(*authConfig, opts)
	}

	return CreateHTTPClient(opts)
}
