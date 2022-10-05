package object

import (
	"context"

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
