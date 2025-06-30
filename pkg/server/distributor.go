package server

import (
	"context"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"go.opentelemetry.io/otel"
)

func (ms *ModuleServer) initIndexServerDistributor() (services.Service, error) {
	var (
		distributor = &distributorService{}
		tracer      = otel.Tracer("index-server-distributor")
		err         error
	)
	distributor.grpcHandler, err = resource.ProvideIndexDistributorServer(ms.cfg, ms.features, ms.registerer, tracer, ms.indexServerRing, ms.indexServerRingClientPool)
	if err != nil {
		return nil, err
	}

	return services.NewBasicService(nil, distributor.running, nil).WithName(modules.IndexServerDistributor), nil
}

type distributorService struct {
	grpcHandler grpcserver.Provider
}

func (d *distributorService) running(ctx context.Context) error {
	return d.grpcHandler.Run(ctx)
}
