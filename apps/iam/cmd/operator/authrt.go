package main

import (
	"fmt"
	"net/http"

	"github.com/grafana/authlib/authn"
)

type authRoundTripper struct {
	tokenExchangeClient *authn.TokenExchangeClient
	transport           http.RoundTripper
}

func (t *authRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	tokenResponse, err := t.tokenExchangeClient.Exchange(req.Context(), authn.TokenExchangeRequest{
		Audiences: []string{"folder.grafana.app"},
		Namespace: "*",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to exchange token: %w", err)
	}

	req.Header.Set("X-Access-Token", "Bearer "+tokenResponse.Token)
	return t.transport.RoundTrip(req)
}
