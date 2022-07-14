package correlations

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

func ProvideService(sqlStore *sqlstore.SQLStore, routeRegister routing.RouteRegister, ds datasources.DataSourceService, ac accesscontrol.AccessControl, bus bus.Bus) *CorrelationsService {
	s := &CorrelationsService{
		SQLStore:          sqlStore,
		RouteRegister:     routeRegister,
		log:               log.New("correlations"),
		DataSourceService: ds,
		AccessControl:     ac,
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
	DataSourceService datasources.DataSourceService
	AccessControl     accesscontrol.AccessControl
}

func (s CorrelationsService) CreateCorrelation(ctx context.Context, cmd CreateCorrelationCommand) (CorrelationDTO, error) {
	return s.createCorrelation(ctx, cmd)
}

func (s CorrelationsService) DeleteCorrelationsBySourceUID(ctx context.Context, cmd DeleteCorrelationsBySourceUIDCommand) error {
	return s.deleteCorrelationsBySourceUID(ctx, cmd)
}

func (s CorrelationsService) handleDatasourceDeletion(ctx context.Context, event *events.DataSourceDeleted) error {
	// DeleteDatasource emits events even when datasources are not actually deleted (see https://github.com/grafana/grafana/pull/51630#issuecomment-1182975633
	// and pkg/services/sqlstore/datasource.go staring at line 134).
	// If that happens we ignore the event.
	if event.UID == "" {
		return nil
	}

	return s.SQLStore.InTransaction(ctx, func(ctx context.Context) error {
		if err := s.deleteCorrelationsBySourceUID(ctx, DeleteCorrelationsBySourceUIDCommand{
			SourceUID: event.UID,
		}); err != nil {
			return err
		}

		if err := s.deleteCorrelationsByTargetUID(ctx, DeleteCorrelationsByTargetUIDCommand{
			TargetUID: event.UID,
		}); err != nil {
			return err
		}

		return nil
	})
}
