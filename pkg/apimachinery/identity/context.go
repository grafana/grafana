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

type AuthCtx struct {
	// OrgID is the organization ID of the request.
	OrgID int64
	// IDClaims identify the user for which the service is making the request.
	IDClaims *authnlib.Claims[authnlib.IDTokenClaims]
	// AccessClaims identify the service making the request.
	AccessClaims *authnlib.Claims[authnlib.AccessTokenClaims]
}

func (a *AuthCtx) SujectID() string {
	if a.IDClaims != nil {
		return a.IDClaims.Subject
	}
	if a.AccessClaims != nil {
		return a.AccessClaims.Subject
	}
	return ""
}

type requestCtxKey struct{}

// WithIDClaims attaches the id claims to the context.
func WithAuthCtx(ctx context.Context, authNCtx *AuthCtx) context.Context {
	return context.WithValue(ctx, requestCtxKey{}, authNCtx)
}

// GetIDClaims gets the id claims from the context.
func GetAuthCtx(ctx context.Context) (*AuthCtx, error) {
	v, ok := ctx.Value(requestCtxKey{}).(*AuthCtx)
	if ok && v != nil {
		return v, nil
	}
	return nil, fmt.Errorf("id claims were not found in the context")
}
