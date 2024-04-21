package authz

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/log"
	grpccontext "github.com/grafana/grafana/pkg/services/grpcserver/context"
)

// NOTE: this whole thing should be moved into a separate package (e.g. multi-tenant authz)

type Authorizer interface {
	Authorize(ctx context.Context, authzParams *AuthZParams) (context.Context, error)
}

type AuthorizerImpl struct {
	contextHandler grpccontext.ContextHandler
	logger         log.Logger
}

var _ Authorizer = (*AuthorizerImpl)(nil)

func ProvideAuthorizer(contextHandler grpccontext.ContextHandler) Authorizer {
	return &AuthorizerImpl{
		contextHandler: contextHandler,
		logger:         log.New("grpc-server-authorizer"),
	}
}

func (f *AuthorizerImpl) Authorize(ctx context.Context, authzParams *AuthZParams) (context.Context, error) {
	// TODO: authlib magic here

	// Special treatment is required for:
	// - list and watch: permission checks have to be done inside storage implementation. Set the fetched
	//   rules in the context to be used in storage implementation.
	// - read: permission checks have to be postponed for after the data is loaded from storage, possibly inside
	//   the interceptor, by inspecting the response and extracting the necessary information from the Entity.

	return ctx, nil
}
