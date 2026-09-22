package authn

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type TokenAuthenticator interface {
	AuthenticateToken(ctx context.Context, token string) (identity.Requester, error)
}

// GrafanaTokenAuthorizer is a temporary stub that returns a fixed identity without validating the token.
type GrafanaTokenAuthorizer struct {
	Dummy identity.Requester
}

func (t *GrafanaTokenAuthorizer) AuthenticateToken(ctx context.Context, token string) (identity.Requester, error) {
	if token == "" {
		return nil, apierrors.NewUnauthorized("empty token")
	}
	return t.Dummy, nil
}
