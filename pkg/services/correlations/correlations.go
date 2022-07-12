package correlations

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvideService(sqlStore *sqlstore.SQLStore, routeRegister routing.RouteRegister, datasourceService datasources.DataSourceService, bus bus.Bus) *CorrelationsService {
	s := &CorrelationsService{
		SQLStore:          sqlStore,
		RouteRegister:     routeRegister,
		log:               log.New("correlations"),
		datasourceService: datasourceService,
	}

	s.registerAPIEndpoints()

	bus.AddEventListener(s.handleDatasourceDeletion)

	return s
}

type Service interface {
	CreateCorrelation(ctx context.Context, cmd CreateCorrelationCommand) (CorrelationDTO, error)
	DeleteCorrelationsBySourceUID(ctx context.Context, cmd DeleteCorrelationsBySourceUIDCommand) error
}

type CorrelationsService struct {
	SQLStore          *sqlstore.SQLStore
	RouteRegister     routing.RouteRegister
	log               log.Logger
	datasourceService datasources.DataSourceService
}

func (s CorrelationsService) CreateCorrelation(ctx context.Context, cmd CreateCorrelationCommand) (CorrelationDTO, error) {
	return s.createCorrelation(ctx, cmd)
}

func (s CorrelationsService) DeleteCorrelationsBySourceUID(ctx context.Context, cmd DeleteCorrelationsBySourceUIDCommand) error {
	return s.deleteCorrelationsBySourceUID(ctx, cmd)
}

func (s CorrelationsService) handleDatasourceDeletion(ctx context.Context, event *events.DataSourceDeleted) error {
	s.deleteCorrelationsBySourceUID(ctx, DeleteCorrelationsBySourceUIDCommand{
		SourceUID: event.UID,
	})

	s.deleteCorrelationsByTargetUID(ctx, DeleteCorrelationsByTargetUIDCommand{
		TargetUID: event.UID,
	})

	return nil
}
