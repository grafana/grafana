package auth

import (
	"context"

	"github.com/go-jose/go-jose/v3/jwt"
	"github.com/grafana/grafana/pkg/services/auth/identity"
)

type IDService interface {
	// SignIdentity signs a id token for provided identity that can be forwarded to plugins and external services
	SignIdentity(ctx context.Context, identity identity.Requester) (string, error)
}

type IDSigner interface {
	SignIDToken(ctx context.Context, claims *IDClaims) (string, error)
}

type IDClaims struct {
	jwt.Claims
}
