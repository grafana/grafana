package server

import (
	"context"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/services/grpcserver/interceptors"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	resourcegrpc "github.com/grafana/grafana/pkg/storage/unified/resource/grpc"
	"github.com/grafana/grafana/pkg/storage/unified/sql"
	"go.opentelemetry.io/otel"
)

func (ms *ModuleServer) initDistributor() (services.Service, error) {
	distributor := &distributorService{}

	tracer := otel.Tracer("unified-storage-distributor")
	// FIXME: This is a temporary solution while we are migrating to the new authn interceptor
	// grpcutils.NewGrpcAuthenticator should be used instead.
	authn := sql.NewAuthenticatorWithFallback(ms.cfg, ms.registerer, tracer, func(ctx context.Context) (context.Context, error) {
		auth := resourcegrpc.Authenticator{Tracer: tracer}
		return auth.Authenticate(ctx)
	})

	var err error
	distributor.grpcHandler, err = resource.ProvideDistributorServer(ms.cfg, ms.features, interceptors.AuthenticatorFunc(authn), ms.registerer, tracer, ms.storageRing, ms.storageRingClientPool)
	if err != nil {
		return nil, err
	}

	return services.NewBasicService(nil, distributor.running, nil).WithName(modules.Distributor), nil
}

type distributorService struct {
	grpcHandler grpcserver.Provider
}

func (d *distributorService) running(ctx context.Context) error {
	return d.grpcHandler.Run(ctx)
}
