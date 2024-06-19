package identity

import (
	"context"
	"fmt"

	authnlib "github.com/grafana/authlib/authn"
)

type ctxUserKey struct{}

// WithRequester attaches the requester to the context.
func WithRequester(ctx context.Context, usr Requester) context.Context {
	return context.WithValue(ctx, ctxUserKey{}, usr)
}

// Get the Requester from context
func GetRequester(ctx context.Context) (Requester, error) {
	// Set by appcontext.WithUser
	u, ok := ctx.Value(ctxUserKey{}).(Requester)
	if ok && u != nil {
		return u, nil
	}
	return nil, fmt.Errorf("a Requester was not found in the context")
}

type idClaimsKey struct{}

// WithIDClaims attaches the id claims to the context.
func WithIDClaims(ctx context.Context, claims *authnlib.Claims[authnlib.IDTokenClaims]) context.Context {
	return context.WithValue(ctx, idClaimsKey{}, claims)
}

// GetIDClaims gets the id claims from the context.
func GetIDClaims(ctx context.Context) (*authnlib.Claims[authnlib.IDTokenClaims], error) {
	u, ok := ctx.Value(idClaimsKey{}).(*authnlib.Claims[authnlib.IDTokenClaims])
	if ok && u != nil {
		return u, nil
	}
	return nil, fmt.Errorf("id claims were not found in the context")
}

type accessClaimsKey struct{}

// WithIDClaims attaches the id claims to the context.
func WithAccessClaims(ctx context.Context, claims *authnlib.Claims[authnlib.AccessTokenClaims]) context.Context {
	return context.WithValue(ctx, accessClaimsKey{}, claims)
}

// GetIDClaims gets the id claims from the context.
func GetAccessClaims(ctx context.Context) (*authnlib.Claims[authnlib.AccessTokenClaims], error) {
	u, ok := ctx.Value(accessClaimsKey{}).(*authnlib.Claims[authnlib.AccessTokenClaims])
	if ok && u != nil {
		return u, nil
	}
	return nil, fmt.Errorf("id claims were not found in the context")
}
