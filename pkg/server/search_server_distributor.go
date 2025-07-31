package server

import (
	"context"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/grpcserver"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"go.opentelemetry.io/otel"
)

func (ms *ModuleServer) initSearchServerDistributor() (services.Service, error) {
	var (
		distributor = &distributorService{}
		tracer      = otel.Tracer("index-server-distributor")
		err         error
	)
	distributor.grpcHandler, err = resource.ProvideSearchDistributorServer(ms.settingsProvider, ms.features, ms.registerer, tracer, ms.searchServerRing, ms.searchServerRingClientPool)
	if err != nil {
		return nil, err
	}

	return services.NewBasicService(nil, distributor.running, nil).WithName(modules.SearchServerDistributor), nil
}

type distributorService struct {
	grpcHandler grpcserver.Provider
}

func (d *distributorService) running(ctx context.Context) error {
	return d.grpcHandler.Run(ctx)
}
