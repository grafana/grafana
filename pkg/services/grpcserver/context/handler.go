package grpccontext

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/user"
)

type ContextHandler interface {
	SetUser(context.Context, *user.SignedInUser) context.Context
	GetUser(context.Context) *user.SignedInUser
}

func ProvideContextHandler(tracer tracing.Tracer) ContextHandler {
	return &contextHandler{
		tracer: tracer,
	}
}

type contextHandler struct {
	tracer tracing.Tracer
}

func (c *contextHandler) fromContext(ctx context.Context) *GRPCServerContext {
	grpcContext := FromContext(ctx)

	if grpcContext != nil {
		return grpcContext
	}

	return &GRPCServerContext{
		Tracer: c.tracer,
		Logger: log.New("grpc-server-context"),
	}
}

func (c *contextHandler) SetUser(ctx context.Context, user *user.SignedInUser) context.Context {
	grpcContext := c.fromContext(ctx)
	grpcContext.SignedInUser = user
	return context.WithValue(ctx, grpcContextKey{}, grpcContext)
}

func (c *contextHandler) GetUser(ctx context.Context) *user.SignedInUser {
	return c.fromContext(ctx).SignedInUser
}
