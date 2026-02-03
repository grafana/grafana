package server

import (
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"go.opentelemetry.io/otel"
)

func (ms *ModuleServer) initSearchServerDistributor() (services.Service, error) {
	tracer := otel.Tracer("index-server-distributor")
	svc := resource.ProvideSearchDistributorService(ms.cfg, tracer, ms.searchServerRing, ms.searchServerRingClientPool)
	if err := svc.RegisterGRPCServices(ms.grpcServer); err != nil {
		return nil, err
	}
	return services.NewBasicService(nil, nil, nil).WithName(modules.SearchServerDistributor), nil
}
