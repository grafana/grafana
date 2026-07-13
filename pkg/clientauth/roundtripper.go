package clientauth

import (
	"fmt"
	"net/http"

	authnlib "github.com/grafana/authlib/authn"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// tokenExchangeRoundTripper wraps an http.RoundTripper and injects an exchanged
// access token into outgoing requests via the X-Access-Token header.
type tokenExchangeRoundTripper struct {
	exchanger         authnlib.TokenExchanger
	transport         http.RoundTripper
	namespaceProvider NamespaceProvider
	audienceProvider  AudienceProvider
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

// RoundTrip implements http.RoundTripper by exchanging a token and setting it
// in the X-Access-Token header before forwarding the request.
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

	req.Header.Set("X-Access-Token", "Bearer "+tokenResponse.Token)

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

// callerTokenForwardingRoundTripper wraps an http.RoundTripper and forwards the
// caller's raw access and ID tokens from the request context via the
// X-Access-Token and X-Grafana-Id headers.
type callerTokenForwardingRoundTripper struct {
	transport http.RoundTripper
}

var _ http.RoundTripper = (*callerTokenForwardingRoundTripper)(nil)

// RoundTrip implements http.RoundTripper by copying the caller's tokens from the
// request context into headers before forwarding the request. Requests without a
// requester or without a raw access token are forwarded unchanged.
func (t *callerTokenForwardingRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	requester, err := identity.GetRequester(req.Context())
	if err != nil || requester.GetAccessToken() == "" {
		return t.transport.RoundTrip(req)
	}

	// Clone the request as RoundTrippers are not expected to mutate the passed request
	req = utilnet.CloneRequest(req)

	req.Header.Set("X-Access-Token", requester.GetAccessToken())
	if idToken := requester.GetIDToken(); idToken != "" {
		req.Header.Set("X-Grafana-Id", idToken)
	}

	return t.transport.RoundTrip(req)
}

// WithCallerTokenForwarding returns a copy of the given rest.Config whose transport
// forwards the caller's tokens. The input config is not modified, so it is safe to
// pass a shared config such as the loopback config.
func WithCallerTokenForwarding(config *rest.Config) *rest.Config {
	configCopy := rest.CopyConfig(config)
	configCopy.Wrap(func(rt http.RoundTripper) http.RoundTripper {
		return &callerTokenForwardingRoundTripper{transport: rt}
	})
	return configCopy
}
