package appcontext

import (
	"context"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
	"github.com/grafana/grafana/pkg/services/user"
)

type ctxUserKey struct{}

// WithUser adds the supplied SignedInUser to the context.
func WithUser(ctx context.Context, usr *user.SignedInUser) context.Context {
	return context.WithValue(ctx, ctxUserKey{}, usr)
}

// User extracts the SignedInUser from the supplied context.
// Supports context set by appcontext.WithUser, gRPC server context, and HTTP ReqContext.
func User(ctx context.Context) *user.SignedInUser {
	// Set by appcontext.WithUser
	u, ok := ctx.Value(ctxUserKey{}).(*user.SignedInUser)
	if ok && u != nil {
		return u
	}

	// Set by incoming gRPC server request
	grpcCtx := grpccontext.FromContext(ctx)
	if grpcCtx != nil && grpcCtx.SignedInUser != nil {
		return grpcCtx.SignedInUser
	}

	// Set by incoming HTTP request
	c, ok := ctxkey.Get(ctx).(*models.ReqContext)
	if !ok || c == nil || c.SignedInUser == nil {
		return nil
	}

	return c.SignedInUser
}
