package grpccontext

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/user"
)

type grpcContextKey struct{}

type GRPCServerContext struct {
	SignedInUser *user.SignedInUser
	Tracer       tracing.Tracer
	Logger       log.Logger
}

func FromContext(ctx context.Context) *GRPCServerContext {
	grpcContext, ok := ctx.Value(grpcContextKey{}).(*GRPCServerContext)
	if !ok {
		return nil
	}
	return grpcContext
}
