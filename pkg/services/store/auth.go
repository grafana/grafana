package store

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
	"github.com/grafana/grafana/pkg/services/user"
)

// UserFromContext ** Experimental **
// TODO: move to global infra package / new auth service
func UserFromContext(ctx context.Context) *user.SignedInUser {
	grpcCtx := grpccontext.FromContext(ctx)
	if grpcCtx != nil {
		return grpcCtx.SignedInUser
	}

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
	if user.IsRealUser() {
		return fmt.Sprintf("user:%d:%s", user.UserID, user.Login)
	}
	return fmt.Sprintf("sys:%d:%s", user.UserID, user.Login)
}
