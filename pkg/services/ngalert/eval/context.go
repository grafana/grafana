package eval

import (
	"context"

	"github.com/grafana/grafana/pkg/services/user"
)

var (
	// signedInUserKey uniquely identifies the signed-in user in a context.Context
	signedInUserKey = struct{}{}
)

// NewSignedInUserContext returns a new context.Context with the signed-in user
func NewSignedInUserContext(ctx context.Context, user *user.SignedInUser) context.Context {
	return context.WithValue(ctx, signedInUserKey, user)
}

// GetSignedInUser returns the signed-in user or nil
func GetSignedInUser(ctx context.Context) *user.SignedInUser {
	if v := ctx.Value(signedInUserKey); v != nil {
		return v.(*user.SignedInUser)
	}
	return nil
}
