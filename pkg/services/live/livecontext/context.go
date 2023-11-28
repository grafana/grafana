package livecontext

import (
	"context"

	"github.com/grafana/grafana/pkg/services/auth/identity"
)

type signedUserContextKeyType int

var signedUserContextKey signedUserContextKeyType

func SetContextSignedUser(ctx context.Context, user identity.Requester) context.Context {
	ctx = context.WithValue(ctx, signedUserContextKey, user)
	return ctx
}

func GetContextSignedUser(ctx context.Context) (identity.Requester, bool) {
	if val := ctx.Value(signedUserContextKey); val != nil {
		user, ok := val.(identity.Requester)
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

type channelIDContextKey struct{}

func SetContextChannelID(ctx context.Context, channelID string) context.Context {
	ctx = context.WithValue(ctx, channelIDContextKey{}, channelID)
	return ctx
}

func GetContextChannelID(ctx context.Context) (string, bool) {
	if val := ctx.Value(channelIDContextKey{}); val != nil {
		values, ok := val.(string)
		return values, ok
	}
	return "", false
}
