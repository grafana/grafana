package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
	"github.com/grafana/grafana/pkg/services/user"
)

type testUserKey struct{}

func ContextWithUser(ctx context.Context, data *user.SignedInUser) context.Context {
	return context.WithValue(ctx, testUserKey{}, data)
}

// UserFromContext ** Experimental **
// TODO: move to global infra package / new auth service
func UserFromContext(ctx context.Context) *user.SignedInUser {
	grpcCtx := grpccontext.FromContext(ctx)
	if grpcCtx != nil {
		return grpcCtx.SignedInUser
	}

	// Explicitly set in context
	u, ok := ctx.Value(testUserKey{}).(*user.SignedInUser)
	if ok && u != nil {
		return u
	}

	// From the HTTP request
	c, ok := ctxkey.Get(ctx).(*models.ReqContext)
	if !ok || c == nil || c.SignedInUser == nil {
		return nil
	}

	return c.SignedInUser
}

// Really just spitballing here :) this should hook into a system that can give better display info
func GetUserIDString(user *user.SignedInUser) string {
	if user == nil {
		return ""
	}
	if user.IsAnonymous {
		return "anon"
	}
	if user.ApiKeyID > 0 {
		return fmt.Sprintf("key:%d", user.UserID)
	}
	if user.IsRealUser() {
		return fmt.Sprintf("user:%d:%s", user.UserID, user.Login)
	}
	return fmt.Sprintf("sys:%d:%s", user.UserID, user.Login)
}
