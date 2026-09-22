package authn

import (
	"context"

	"github.com/grafana/authlib/types"
)

// This type (and implementation?) should be moved to authlib
type TokenAuthenticator interface {
	// Given a token, return valid AuthInfo
	AuthenticateToken(ctx context.Context, token string) (types.AuthInfo, error)
}

// GrafanaTokenAuthorizer is a temporary stub that returns a fixed identity without validating the token.
type GrafanaTokenAuthorizer struct {
	Dummy types.AuthInfo
}

func (t *GrafanaTokenAuthorizer) AuthenticateToken(ctx context.Context, token string) (types.AuthInfo, error) {
	return t.Dummy, nil
}
