package clientauth

import (
	"fmt"
	"net/http"

	authnlib "github.com/grafana/authlib/authn"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/client-go/transport"
)

// tokenExchangeRoundTripper wraps an http.RoundTripper and injects an exchanged
// access token into outgoing requests. The token goes in the X-Access-Token
// header by default; header can override that (e.g. Authorization for apiservers
// that authenticate a standard bearer token).
type tokenExchangeRoundTripper struct {
	exchanger         authnlib.TokenExchanger
	transport         http.RoundTripper
	namespaceProvider NamespaceProvider
	audienceProvider  AudienceProvider
	header            string
}

var _ http.RoundTripper = (*tokenExchangeRoundTripper)(nil)

// newTokenExchangeRoundTripperWithStrategies creates a new RoundTripper with custom
// namespace and audience strategies, allowing for flexible configuration.
func newTokenExchangeRoundTripperWithStrategies(
	exchanger authnlib.TokenExchanger,
	transport http.RoundTripper,
	namespaceProvider NamespaceProvider,
	audienceProvider AudienceProvider,
) *tokenExchangeRoundTripper {
	return &tokenExchangeRoundTripper{
		exchanger:         exchanger,
		transport:         transport,
		namespaceProvider: namespaceProvider,
		audienceProvider:  audienceProvider,
	}
}

// RoundTrip implements http.RoundTripper by exchanging a token and setting it in
// the configured header (X-Access-Token by default) before forwarding the request.
func (t *tokenExchangeRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	ctx := req.Context()

	tokenResponse, err := t.exchanger.Exchange(ctx, authnlib.TokenExchangeRequest{
		Audiences: t.audienceProvider.GetAudiences(ctx),
		Namespace: t.namespaceProvider.GetNamespace(ctx),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to exchange token: %w", err)
	}

	// Clone the request as RoundTrippers are not expected to mutate the passed request
	req = utilnet.CloneRequest(req)

	header := t.header
	if header == "" {
		header = "X-Access-Token"
	}
	req.Header.Set(header, "Bearer "+tokenResponse.Token)

	return t.transport.RoundTrip(req)
}

// NewStaticTokenExchangeTransportWrapper creates a transport.WrapperFunc that wraps
// an http.RoundTripper with token exchange authentication for use with k8s
// rest.Config.WrapTransport.
func NewStaticTokenExchangeTransportWrapper(
	exchanger authnlib.TokenExchanger,
	audience string,
	namespace string,
) transport.WrapperFunc {
	return func(rt http.RoundTripper) http.RoundTripper {
		return newTokenExchangeRoundTripperWithStrategies(exchanger, rt, NewStaticNamespaceProvider(namespace), NewStaticAudienceProvider(audience))
	}
}

// NewStaticTokenExchangeAuthorizationTransportWrapper is like
// NewStaticTokenExchangeTransportWrapper but sends the exchanged token in the
// standard Authorization header instead of X-Access-Token. Use it for apiservers
// that authenticate a bearer token from Authorization (e.g. the app-platform
// apiserver) rather than the authlib X-Access-Token header.
func NewStaticTokenExchangeAuthorizationTransportWrapper(
	exchanger authnlib.TokenExchanger,
	audience string,
	namespace string,
) transport.WrapperFunc {
	return func(rt http.RoundTripper) http.RoundTripper {
		t := newTokenExchangeRoundTripperWithStrategies(exchanger, rt, NewStaticNamespaceProvider(namespace), NewStaticAudienceProvider(audience))
		t.header = "Authorization"
		return t
	}
}

// NewTokenExchangeTransportWrapperWithStrategies creates a transport.WrapperFunc with custom strategies.
func NewTokenExchangeTransportWrapper(
	exchanger authnlib.TokenExchanger,
	audienceProvider AudienceProvider,
	namespaceProvider NamespaceProvider,
) transport.WrapperFunc {
	return func(rt http.RoundTripper) http.RoundTripper {
		return newTokenExchangeRoundTripperWithStrategies(
			exchanger,
			rt,
			namespaceProvider,
			audienceProvider,
		)
	}
}

// WildcardNamespace is a convenience constant for the wildcard namespace.
const WildcardNamespace = "*"
