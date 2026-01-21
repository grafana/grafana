// Package auth provides authentication utilities for the provisioning API.
package auth

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/authlib/authn"
	utilnet "k8s.io/apimachinery/pkg/util/net"
)

// tokenExchanger abstracts the token exchange client for testability.
type tokenExchanger interface {
	Exchange(ctx context.Context, req authn.TokenExchangeRequest) (*authn.TokenExchangeResponse, error)
}

// RoundTripperOption configures optional behavior for the RoundTripper.
type RoundTripperOption func(*RoundTripper)

// ExtraAudience appends an additional audience to the token exchange request.
//
// This is primarily used by operators connecting to the multitenant aggregator,
// where the token must include both the target API server's audience (e.g., dashboards,
// folders) and the provisioning group audience. The provisioning group audience is
// required so that the token passes the enforceManagerProperties check, which prevents
// unauthorized updates to provisioned resources.
//
// Example:
//
//	authrt.NewRoundTripper(client, rt, "dashboards.grafana.app", authrt.ExtraAudience("provisioning.grafana.app"))
func ExtraAudience(audience string) RoundTripperOption {
	return func(rt *RoundTripper) {
		rt.extraAudience = audience
	}
}

// RoundTripper is an http.RoundTripper that performs token exchange before each request.
// It exchanges the service's credentials for an access token scoped to the configured
// audience(s), then injects that token into the outgoing request's X-Access-Token header.
type RoundTripper struct {
	client        tokenExchanger
	transport     http.RoundTripper
	audience      string
	extraAudience string
}

// NewRoundTripper creates a RoundTripper that exchanges tokens for each outgoing request.
//
// Parameters:
//   - tokenExchangeClient: the client used to exchange credentials for access tokens
//   - base: the underlying transport to delegate requests to after token injection
//   - audience: the primary audience for the token (typically the target API server's group)
//   - opts: optional configuration (e.g., ExtraAudience to include additional audiences)
func NewRoundTripper(tokenExchangeClient tokenExchanger, base http.RoundTripper, audience string, opts ...RoundTripperOption) *RoundTripper {
	rt := &RoundTripper{
		client:    tokenExchangeClient,
		transport: base,
		audience:  audience,
	}
	for _, opt := range opts {
		opt(rt)
	}
	return rt
}

// RoundTrip exchanges credentials for an access token and injects it into the request.
// The token is scoped to all configured audiences and the wildcard namespace ("*").
func (t *RoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	audiences := []string{t.audience}
	if t.extraAudience != "" && t.extraAudience != t.audience {
		audiences = append(audiences, t.extraAudience)
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
