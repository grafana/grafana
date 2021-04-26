package livecontext

import (
	"context"
	"net/url"

	"github.com/grafana/grafana/pkg/models"
)

type signedUserContextKeyType int

var signedUserContextKey signedUserContextKeyType

func SetContextSignedUser(ctx context.Context, user *models.SignedInUser) context.Context {
	ctx = context.WithValue(ctx, signedUserContextKey, user)
	return ctx
}

func GetContextSignedUser(ctx context.Context) (*models.SignedInUser, bool) {
	if val := ctx.Value(signedUserContextKey); val != nil {
		user, ok := val.(*models.SignedInUser)
		return user, ok
	}
	return nil, false
}

type valuesContextKey struct{}

func SetContextValues(ctx context.Context, values url.Values) context.Context {
	ctx = context.WithValue(ctx, valuesContextKey{}, values)
	return ctx
}

func GetContextValues(ctx context.Context) (url.Values, bool) {
	if val := ctx.Value(valuesContextKey{}); val != nil {
		values, ok := val.(url.Values)
		return values, ok
	}
	return nil, false
}
