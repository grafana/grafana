package httpclient

import (
	"crypto/tls"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

// Provider provides abilities to create http.Client, http.RoundTripper and tls.Config.
type Provider interface {
	// New creates a new http.Client given provided options.
	New(opts ...httpclient.Options) (*http.Client, error)

	// GetTransport creates a new http.RoundTripper given provided options.
	GetTransport(opts ...httpclient.Options) (http.RoundTripper, error)

	// GetTLSConfig creates a new tls.Config given provided options.
	GetTLSConfig(opts ...httpclient.Options) (*tls.Config, error)
}

// NewProvider creates a new HTTP client provider.
// Optionally provide ProviderOptions options that will be used as default if
// not specified in Options argument to Provider.New, Provider.GetTransport and
// Provider.GetTLSConfig.
// If no middlewares are provided in opts the DefaultMiddlewares() will be used. If you
// provide middlewares you have to manually add the DefaultMiddlewares() for it to be
// enabled.
// Note: Middlewares will be executed in the same order as provided.
func NewProvider(opts ...httpclient.ProviderOptions) *httpclient.Provider {
	return httpclient.NewProvider(opts...)
}
