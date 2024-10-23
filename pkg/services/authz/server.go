package authz

import (
	"context"
	"errors"

	"github.com/grafana/authlib/authz"
	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	grpc_auth "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/auth"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
)

var _ authzv1.AuthzServiceServer = (*legacyServer)(nil)
var _ grpc_auth.ServiceAuthFuncOverride = (*legacyServer)(nil)
var _ authz.ServiceAuthorizeFuncOverride = (*legacyServer)(nil)

func newLegacyServer(
	acSvc accesscontrol.Service, features featuremgmt.FeatureToggles,
	grpcServer grpcserver.Provider, tracer tracing.Tracer, cfg *Cfg,
) (*legacyServer, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) {
		return nil, nil
	}

	l := &legacyServer{
		acSvc:  acSvc,
		logger: log.New("authz-grpc-server"),
		tracer: tracer,
	}

	if cfg.listen {
		if !cfg.allowInsecure {
			l.logger.Error("Not allowing the authz service to run in insecure mode as Auth is skipped")
		} else {
			grpcServer.GetServer().RegisterService(&authzv1.AuthzService_ServiceDesc, l)
		}
	}

	return l, nil
}

type legacyServer struct {
	authzv1.UnimplementedAuthzServiceServer

	acSvc  accesscontrol.Service
	logger log.Logger
	tracer tracing.Tracer
}

// AuthFuncOverride is a function that allows to override the default auth function.
// This is ok for now since we don't have on-prem access token support.
func (l *legacyServer) AuthFuncOverride(ctx context.Context, _ string) (context.Context, error) {
	ctx, span := l.tracer.Start(ctx, "authz.AuthFuncOverride")
	defer span.End()

	return ctx, nil
}

// AuthorizeFuncOverride is a function that allows to override the default authorize function that checks the namespace of the caller.
// This is ok for now since we don't have on-prem access token support.
func (l *legacyServer) AuthorizeFuncOverride(ctx context.Context) error {
	_, span := l.tracer.Start(ctx, "authz.AuthorizeFuncOverride")
	defer span.End()

	return nil
}

func (l *legacyServer) Check(context.Context, *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	// FIXME: implement for legacy access control
	return nil, errors.New("unimplemented")
}
