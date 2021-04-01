package live

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
)

type signedUserContextKeyType int

var signedUserContextKey signedUserContextKeyType

func setContextSignedUser(ctx context.Context, user *models.SignedInUser) context.Context {
	ctx = context.WithValue(ctx, signedUserContextKey, user)
	return ctx
}

func getContextSignedUser(ctx context.Context) (*models.SignedInUser, bool) {
	if val := ctx.Value(signedUserContextKey); val != nil {
		user, ok := val.(*models.SignedInUser)
		return user, ok
	}
	return nil, false
}
