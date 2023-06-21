package correlations

import (
	"context"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
)

var (
	logger = log.New("correlations")
)

func ProvideService(sqlStore db.DB, routeRegister routing.RouteRegister, ds datasources.DataSourceService, ac accesscontrol.AccessControl, bus bus.Bus, qs quota.Service, cfg *setting.Cfg,
) (*CorrelationsService, error) {
	s := &CorrelationsService{
		SQLStore:          sqlStore,
		RouteRegister:     routeRegister,
		log:               logger,
		DataSourceService: ds,
		AccessControl:     ac,
		QuotaService:      qs,
	}

	s.registerAPIEndpoints()

	bus.AddEventListener(s.handleDatasourceDeletion)

	defaultLimits, err := readQuotaConfig(cfg)
	if err != nil {
		return s, err
	}

	if err := qs.RegisterQuotaReporter(&quota.NewUsageReporter{
		TargetSrv:     QuotaTargetSrv,
		DefaultLimits: defaultLimits,
		Reporter:      s.Usage,
	}); err != nil {
		return s, err
	}

	return s, nil
}

type Service interface {
	CreateCorrelation(ctx context.Context, cmd CreateCorrelationCommand) (Correlation, error)
	DeleteCorrelation(ctx context.Context, cmd DeleteCorrelationCommand) error
	DeleteCorrelationsBySourceUID(ctx context.Context, cmd DeleteCorrelationsBySourceUIDCommand) error
	DeleteCorrelationsByTargetUID(ctx context.Context, cmd DeleteCorrelationsByTargetUIDCommand) error
}

type CorrelationsService struct {
	SQLStore          db.DB
	RouteRegister     routing.RouteRegister
	log               log.Logger
	DataSourceService datasources.DataSourceService
	AccessControl     accesscontrol.AccessControl
	QuotaService      quota.Service
}

func (s CorrelationsService) CreateCorrelation(ctx context.Context, cmd CreateCorrelationCommand) (Correlation, error) {
	quotaReached, err := s.QuotaService.CheckQuotaReached(ctx, QuotaTargetSrv, nil)
	if err != nil {
		logger.Warn("Error getting correlation quota.", "error", err)
		return Correlation{}, ErrCorrelationsQuotaFailed
	}
	if quotaReached {
		return Correlation{}, ErrCorrelationsQuotaReached
	}

	return s.createCorrelation(ctx, cmd)
}

func (s CorrelationsService) DeleteCorrelation(ctx context.Context, cmd DeleteCorrelationCommand) error {
	return s.deleteCorrelation(ctx, cmd)
}

func (s CorrelationsService) UpdateCorrelation(ctx context.Context, cmd UpdateCorrelationCommand) (Correlation, error) {
	return s.updateCorrelation(ctx, cmd)
}

func (s CorrelationsService) GetCorrelation(ctx context.Context, cmd GetCorrelationQuery) (Correlation, error) {
	return s.getCorrelation(ctx, cmd)
}

func (s CorrelationsService) GetCorrelationsBySourceUID(ctx context.Context, cmd GetCorrelationsBySourceUIDQuery) ([]Correlation, error) {
	return s.getCorrelationsBySourceUID(ctx, cmd)
}

func (s CorrelationsService) GetCorrelations(ctx context.Context, cmd GetCorrelationsQuery) ([]Correlation, error) {
	return s.getCorrelations(ctx, cmd)
}

func (s CorrelationsService) DeleteCorrelationsBySourceUID(ctx context.Context, cmd DeleteCorrelationsBySourceUIDCommand) error {
	return s.deleteCorrelationsBySourceUID(ctx, cmd)
}

func (s CorrelationsService) DeleteCorrelationsByTargetUID(ctx context.Context, cmd DeleteCorrelationsByTargetUIDCommand) error {
	return s.deleteCorrelationsByTargetUID(ctx, cmd)
}

func (s CorrelationsService) handleDatasourceDeletion(ctx context.Context, event *events.DataSourceDeleted) error {
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

func (s *CorrelationsService) Usage(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	return s.CountCorrelations(ctx)
}

func readQuotaConfig(cfg *setting.Cfg) (*quota.Map, error) {
	limits := &quota.Map{}

	if cfg == nil {
		return limits, nil
	}

	globalQuotaTag, err := quota.NewTag(QuotaTargetSrv, QuotaTarget, quota.GlobalScope)
	if err != nil {
		return limits, err
	}

	limits.Set(globalQuotaTag, cfg.Quota.Global.Correlations)
	return limits, nil
}
