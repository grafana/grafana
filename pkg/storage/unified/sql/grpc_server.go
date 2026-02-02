package sql

import (
	"context"

	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/prometheus/client_golang/prometheus"
)

const grpcServerServiceName = "unified-storage-grpc-server"

// ProvideUnifiedStorageGRPCService builds the gRPC handler as a dskit service.
func ProvideUnifiedStorageGRPCService(cfg *setting.Cfg, features featuremgmt.FeatureToggles, reg prometheus.Registerer) (*grpcserver.DSKitService, error) {
	tracer := otel.Tracer("unified-storage")
	// FIXME: This is a temporary solution while we are migrating to the new authn interceptor
	// grpcutils.NewGrpcAuthenticator should be used instead.
	authn := NewAuthenticatorWithFallback(cfg, reg, tracer, func(ctx context.Context) (context.Context, error) {
		auth := grpc.Authenticator{Tracer: tracer}
		return auth.Authenticate(ctx)
	})

	handler, err := grpcserver.ProvideService(cfg, features, interceptors.AuthenticatorFunc(authn), tracer, prometheus.DefaultRegisterer)
	if err != nil {
		return nil, err
	}

	return grpcserver.ProvideDSKitService(handler, grpcServerServiceName), nil
}
