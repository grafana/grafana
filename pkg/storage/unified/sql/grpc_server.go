package sql

import (
	"context"

	"go.opentelemetry.io/otel"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/prometheus/client_golang/prometheus"
)

const grpcServerServiceName = "grpc-server"

// ProvideUnifiedStorageGrpcServer builds the gRPC handler and wraps it in a dskit service.
func ProvideUnifiedStorageGrpcServer(cfg *setting.Cfg, features featuremgmt.FeatureToggles, reg prometheus.Registerer) (grpcserver.Provider, services.Service, error) {
	tracer := otel.Tracer("unified-storage")
	// FIXME: This is a temporary solution while we are migrating to the new authn interceptor
	// grpcutils.NewGrpcAuthenticator should be used instead.
	authn := NewAuthenticatorWithFallback(cfg, reg, tracer, func(ctx context.Context) (context.Context, error) {
		auth := grpc.Authenticator{Tracer: tracer}
		return auth.Authenticate(ctx)
	})

	handler, err := grpcserver.ProvideService(cfg, features, interceptors.AuthenticatorFunc(authn), tracer, prometheus.DefaultRegisterer)
	if err != nil {
		return nil, nil, err
	}

	return handler, newGrpcServerService(handler), nil
}

type grpcServerService struct {
	*services.BasicService
	handler grpcserver.Provider
}

func newGrpcServerService(handler grpcserver.Provider) services.Service {
	svc := &grpcServerService{handler: handler}
	svc.BasicService = services.NewBasicService(nil, svc.running, nil).WithName(grpcServerServiceName)
	return svc
}

func (s *grpcServerService) running(ctx context.Context) error {
	return s.handler.Run(ctx)
}
