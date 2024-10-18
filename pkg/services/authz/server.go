package authz

import (
	"context"
	"errors"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
)

var _ authzv1.AuthzServiceServer = (*legacyServer)(nil)

func newLegacyServer(
	acSvc accesscontrol.Service, features featuremgmt.FeatureToggles,
	grpcServer grpcserver.Provider, tracer tracing.Tracer, cfg *Cfg,
) (*legacyServer, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagAuthZGRPCServer) {
		return nil, nil
	}

	s := &legacyServer{
		acSvc:  acSvc,
		logger: log.New("authz-grpc-server"),
		tracer: tracer,
		cfg:    cfg,
	}

	if cfg.listen {
		grpcServer.GetServer().RegisterService(&authzv1.AuthzService_ServiceDesc, s)
	}

	return s, nil
}

// AuthFuncOverride is a function that allows to override the default auth function.
// This override is only allowed in development mode as we skip all authentication checks.
func (s *legacyServer) AuthFuncOverride(ctx context.Context, _ string) (context.Context, error) {
	ctx, span := s.tracer.Start(ctx, "authz.AuthFuncOverride")
	defer span.End()

	if !s.cfg.allowInsecure {
		s.logger.Error("AuthFuncOverride is not allowed in production mode")
		return nil, tracing.Errorf(span, "AuthFuncOverride is not allowed in production mode")
	}
	return ctx, nil
}

// AuthorizeFuncOverride is a function that allows to override the default authorize function that checks the namespace of the caller.
// We skip all authorization checks in development mode. Once we have access tokens, we need to do namespace validation in the Read handler.
func (s *legacyServer) AuthorizeFuncOverride(ctx context.Context) error {
	_, span := s.tracer.Start(ctx, "authz.AuthorizeFuncOverride")
	defer span.End()

	if !s.cfg.allowInsecure {
		s.logger.Error("AuthorizeFuncOverride is not allowed in production mode")
		return tracing.Errorf(span, "AuthorizeFuncOverride is not allowed in production mode")
	}
	return nil
}

type legacyServer struct {
	authzv1.UnimplementedAuthzServiceServer

	acSvc  accesscontrol.Service
	logger log.Logger
	tracer tracing.Tracer
	cfg    *Cfg
}

func (l *legacyServer) Check(context.Context, *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	// FIXME: implement for legacy access control
	return nil, errors.New("unimplemented")
}
