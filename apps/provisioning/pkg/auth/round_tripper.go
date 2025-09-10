package auth

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
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
	audience  string
}

// NewRoundTripper constructs a RoundTripper that exchanges the provided token per request
// and forwards the request to the provided base transport.
func NewRoundTripper(tokenExchangeClient tokenExchanger, base http.RoundTripper, audience string) *RoundTripper {
	return &RoundTripper{
		client:    tokenExchangeClient,
		transport: base,
		audience:  audience,
	}
}

func (t *RoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	// when we want to write resources with the provisioning API, the audience needs to include provisioning
	// so that it passes the check in enforceManagerProperties, which prevents others from updating provisioned resources
	audiences := []string{t.audience}
	if t.audience != v0alpha1.GROUP {
		audiences = append(audiences, v0alpha1.GROUP)
	}

	tokenResponse, err := t.client.Exchange(req.Context(), authn.TokenExchangeRequest{
		Audiences: audiences,
		Namespace: "*",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to exchange token: %w", err)
	}

	req = utilnet.CloneRequest(req)
	req.Header.Set("X-Access-Token", "Bearer "+tokenResponse.Token)
	return t.transport.RoundTrip(req)
}
