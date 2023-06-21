package appcontext

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
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
func User(ctx context.Context) (*user.SignedInUser, error) {
	// Set by appcontext.WithUser
	u, ok := ctx.Value(ctxUserKey{}).(*user.SignedInUser)
	if ok && u != nil {
		return u, nil
	}

	// Set by incoming gRPC server request
	grpcCtx := grpccontext.FromContext(ctx)
	if grpcCtx != nil && grpcCtx.SignedInUser != nil {
		return grpcCtx.SignedInUser, nil
	}

	// Set by incoming HTTP request
	c, ok := ctxkey.Get(ctx).(*contextmodel.ReqContext)
	if ok && c.SignedInUser != nil {
		return c.SignedInUser, nil
	}

	return nil, fmt.Errorf("a SignedInUser was not found in the context")
}

// MustUser extracts the SignedInUser from the supplied context, and panics if a user is not found.
// Supports context set by appcontext.WithUser, gRPC server context, and HTTP ReqContext.
func MustUser(ctx context.Context) *user.SignedInUser {
	usr, err := User(ctx)
	if err != nil {
		panic(err)
	}
	return usr
}
