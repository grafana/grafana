package source

import (
	"context"
	"net/http"

	sourcev1 "github.com/grafana/grafana/apps/provisioning/pkg/source/v1"
)

// TokenExchanger mints a short-lived access token for an audience in a namespace.
type TokenExchanger interface {
	Exchange(ctx context.Context, namespace, audience string) (string, error)
}

// bearerAuth sends a long-lived token in the Authorization header.
type bearerAuth struct{ token string }

func (a bearerAuth) Authenticate(_ context.Context, req *http.Request) error {
	req.Header.Set("Authorization", "Bearer "+a.token)
	return nil
}

// exchangeAuth exchanges a short-lived token per request, with the repository's namespace
// and the API group as audience. Nothing is stored, so nothing rotates.
type exchangeAuth struct {
	exchanger TokenExchanger
	namespace string
}

func (a exchangeAuth) Authenticate(ctx context.Context, req *http.Request) error {
	token, err := a.exchanger.Exchange(ctx, a.namespace, sourcev1.Group)
	if err != nil {
		return err
	}
	req.Header.Set("X-Access-Token", "Bearer "+token)
	return nil
}
