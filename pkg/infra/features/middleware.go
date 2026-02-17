package features

import (
	"fmt"
	"net/http"

	authlib "github.com/grafana/authlib/authn"
	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"
)

// TokenExchangeMiddleware provides HTTP middleware for exchanging tokens
// in requests to authenticated OpenFeature providers.
type TokenExchangeMiddleware struct {
	tokenExchangeClient authlib.TokenExchanger
	namespace           string
}

// NewTokenExchangeMiddleware creates a new token exchange middleware.
//
// The namespace parameter specifies the token exchange namespace:
//   - Use a specific namespace (e.g., "stack-123") for single-tenant services
//   - Use "*" for multi-tenant services that work across multiple namespaces
func NewTokenExchangeMiddleware(tokenExchangeClient authlib.TokenExchanger, namespace string) *TokenExchangeMiddleware {
	return &TokenExchangeMiddleware{
		tokenExchangeClient: tokenExchangeClient,
		namespace:           namespace,
	}
}

type tokenExchangeMiddlewareImpl struct {
	tokenExchangeClient authlib.TokenExchanger
	namespace           string
	audiences           []string
	next                http.RoundTripper
}

var _ http.RoundTripper = &tokenExchangeMiddlewareImpl{}

// new creates a new middleware function with the given audiences.
// Returns a MiddlewareFunc compatible with grafana-plugin-sdk-go httpclient.
func (p *TokenExchangeMiddleware) new(audiences []string) sdkhttpclient.MiddlewareFunc {
	return func(opts sdkhttpclient.Options, next http.RoundTripper) http.RoundTripper {
		return &tokenExchangeMiddlewareImpl{
			tokenExchangeClient: p.tokenExchangeClient,
			namespace:           p.namespace,
			audiences:           audiences,
			next:                next,
		}
	}
}

func (m tokenExchangeMiddlewareImpl) RoundTrip(req *http.Request) (*http.Response, error) {
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
