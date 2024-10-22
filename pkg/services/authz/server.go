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
	}

	if cfg.listen {
		grpcServer.GetServer().RegisterService(&authzv1.AuthzService_ServiceDesc, s)
	}

	return s, nil
}

type legacyServer struct {
	authzv1.UnimplementedAuthzServiceServer

	acSvc  accesscontrol.Service
	logger log.Logger
	tracer tracing.Tracer
}

func (l *legacyServer) Check(context.Context, *authzv1.CheckRequest) (*authzv1.CheckResponse, error) {
	// FIXME: implement for legacy access control
	return nil, errors.New("unimplemented")
}
