package server

import (
	"context"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"go.opentelemetry.io/otel"
)

func (ms *ModuleServer) initDistributor() (services.Service, error) {
	var (
		distributor = &distributorService{}
		tracer = otel.Tracer("unified-storage-distributor")
		err error
	)
	distributor.grpcHandler, err = resource.ProvideDistributorServer(ms.cfg, ms.features, ms.registerer, tracer, ms.storageRing, ms.storageRingClientPool)
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
