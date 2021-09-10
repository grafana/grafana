package livecontext

import (
	"context"

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

type streamIDContextKey struct{}

func SetContextStreamID(ctx context.Context, streamID string) context.Context {
	ctx = context.WithValue(ctx, streamIDContextKey{}, streamID)
	return ctx
}

func GetContextStreamID(ctx context.Context) (string, bool) {
	if val := ctx.Value(streamIDContextKey{}); val != nil {
		values, ok := val.(string)
		return values, ok
	}
	return "", false
}
