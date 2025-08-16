package auth

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/authlib/authn"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	utilnet "k8s.io/apimachinery/pkg/util/net"
)

// tokenExchanger abstracts the token exchange client for testability.
type tokenExchanger interface {
	Exchange(ctx context.Context, req authn.TokenExchangeRequest) (*authn.TokenExchangeResponse, error)
}

// RoundTripper injects an exchanged access token for the provisioning API into outgoing requests.
type RoundTripper struct {
	client    tokenExchanger
	transport http.RoundTripper
}

// NewRoundTripper constructs a RoundTripper that exchanges the provided token per request
// and forwards the request to the provided base transport.
func NewRoundTripper(tokenExchangeClient tokenExchanger, base http.RoundTripper) *RoundTripper {
	return &RoundTripper{
		client:    tokenExchangeClient,
		transport: base,
	}
}

func (t *RoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	tokenResponse, err := t.client.Exchange(req.Context(), authn.TokenExchangeRequest{
		Audiences: []string{provisioning.GROUP},
		Namespace: "*",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to exchange token: %w", err)
	}

	req = utilnet.CloneRequest(req)
	req.Header.Set("X-Access-Token", "Bearer "+tokenResponse.Token)
	return t.transport.RoundTrip(req)
}
