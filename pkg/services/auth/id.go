package auth

import (
	"context"

	authnlib "github.com/grafana/authlib/authn"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

//go:generate mockery --name IDService --structname MockService --outpkg idtest --filename mock.go --output ./idtest/
type IDService interface {
	// SignIdentity signs a id token for provided identity that can be forwarded to plugins and external services
	SignIdentity(ctx context.Context, id identity.Requester) (string, *authnlib.Claims[authnlib.IDTokenClaims], error)

	// RemoveIDToken removes any locally stored id tokens for key
	RemoveIDToken(ctx context.Context, identity identity.Requester) error
}

type IDSigner interface {
	SignIDToken(ctx context.Context, claims *IDClaims) (string, error)
}

type IDClaims = authnlib.Claims[authnlib.IDTokenClaims]
