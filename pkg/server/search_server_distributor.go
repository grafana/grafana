package server

import (
	"context"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"go.opentelemetry.io/otel"
)

func (ms *ModuleServer) initSearchServerDistributor() (services.Service, error) {
	tracer := otel.Tracer("index-server-distributor")
	svc := resource.ProvideSearchDistributorService(tracer, ms.searchServerRing, ms.searchServerRingClientPool)
	if err := svc.RegisterGRPCServices(ms.grpcServer); err != nil {
		return nil, err
	}
	// The service needs a running function to stay alive until shutdown
	running := func(ctx context.Context) error {
		<-ctx.Done()
		return nil
	}
	return services.NewBasicService(nil, running, nil).WithName(modules.SearchServerDistributor), nil
}
