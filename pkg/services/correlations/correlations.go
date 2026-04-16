package correlations

import (
	"context"
	"sync"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/resource"
	v0alpha1 "github.com/grafana/grafana/apps/correlations/pkg/apis/correlation/v0alpha1"
	"github.com/grafana/grafana/pkg/api/routing"
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

type Service interface {
	GetCorrelation(ctx context.Context, cmd GetCorrelationQuery) (Correlation, error)
	GetCorrelations(ctx context.Context, cmd GetCorrelationsQuery) (GetCorrelationsResponseBody, error)
	CreateCorrelation(ctx context.Context, cmd CreateCorrelationCommand) (Correlation, error)
	UpdateCorrelation(ctx context.Context, cmd UpdateCorrelationCommand) (Correlation, error)
	CreateOrUpdateCorrelation(ctx context.Context, cmd CreateCorrelationCommand) error
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

type CorrelationsK8sService struct {
	RouteRegister     routing.RouteRegister
	log               log.Logger
	AccessControl     accesscontrol.AccessControl
	QuotaService      quota.Service
	k8sClientInitOnce sync.Once
	clientGen         resource.ClientGenerator
	k8sClient         *v0alpha1.CorrelationClient
	k8sClientInitErr  error
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

func (s *CorrelationsK8sService) CreateCorrelation(ctx context.Context, cmd CreateCorrelationCommand) (Correlation, error) {
	return Correlation{}, nil
}

func (s CorrelationsService) CreateOrUpdateCorrelation(ctx context.Context, cmd CreateCorrelationCommand) error {
	return s.createOrUpdateCorrelation(ctx, cmd)
}

func (s *CorrelationsK8sService) CreateOrUpdateCorrelation(ctx context.Context, cmd CreateCorrelationCommand) error {
	return nil
}

func (s CorrelationsService) DeleteCorrelation(ctx context.Context, cmd DeleteCorrelationCommand) error {
	return s.deleteCorrelation(ctx, cmd)
}

func (s *CorrelationsK8sService) DeleteCorrelation(ctx context.Context, cmd DeleteCorrelationCommand) error {
	return nil
}

func (s CorrelationsService) UpdateCorrelation(ctx context.Context, cmd UpdateCorrelationCommand) (Correlation, error) {
	return s.updateCorrelation(ctx, cmd)
}

func (s *CorrelationsK8sService) UpdateCorrelation(ctx context.Context, cmd UpdateCorrelationCommand) (Correlation, error) {
	return Correlation{}, nil
}

func (s CorrelationsService) GetCorrelation(ctx context.Context, cmd GetCorrelationQuery) (Correlation, error) {
	return s.getCorrelation(ctx, cmd)
}

func (s *CorrelationsK8sService) GetCorrelation(ctx context.Context, cmd GetCorrelationQuery) (Correlation, error) {
	client, err := s.getK8sClient()
	if err != nil {
		return Correlation{}, err
	}

	identifier := resource.Identifier{
		Namespace: authlib.OrgNamespaceFormatter(cmd.OrgId),
		Name:      cmd.UID,
	}

	appPlatformCorr, err := client.Get(ctx, identifier)
	if err != nil {
		return Correlation{}, err
	}

	legacyCorr, err := ToCorrelation(appPlatformCorr)
	if err != nil {
		return Correlation{}, err
	}

	return *legacyCorr, nil
}

func (s CorrelationsService) GetCorrelationsBySourceUID(ctx context.Context, cmd GetCorrelationsBySourceUIDQuery) ([]Correlation, error) {
	return s.getCorrelationsBySourceUID(ctx, cmd)
}

func (s *CorrelationsK8sService) GetCorrelationsBySourceUID(ctx context.Context, cmd GetCorrelationsBySourceUIDQuery) ([]Correlation, error) {
	return []Correlation{}, nil
}

func (s CorrelationsService) GetCorrelations(ctx context.Context, cmd GetCorrelationsQuery) (GetCorrelationsResponseBody, error) {
	return s.getCorrelations(ctx, cmd)
}

func (s *CorrelationsK8sService) GetCorrelations(ctx context.Context, cmd GetCorrelationsQuery) (GetCorrelationsResponseBody, error) {
	return GetCorrelationsResponseBody{}, nil
}

func (s CorrelationsService) DeleteCorrelationsBySourceUID(ctx context.Context, cmd DeleteCorrelationsBySourceUIDCommand) error {
	return s.deleteCorrelationsBySourceUID(ctx, cmd)
}

func (s *CorrelationsK8sService) DeleteCorrelationsBySourceUID(ctx context.Context, cmd DeleteCorrelationsBySourceUIDCommand) error {
	return nil
}

func (s CorrelationsService) DeleteCorrelationsByTargetUID(ctx context.Context, cmd DeleteCorrelationsByTargetUIDCommand) error {
	return s.deleteCorrelationsByTargetUID(ctx, cmd)
}

func (s *CorrelationsK8sService) DeleteCorrelationsByTargetUID(ctx context.Context, cmd DeleteCorrelationsByTargetUIDCommand) error {
	return nil
}

func (s CorrelationsService) handleDatasourceDeletion(ctx context.Context, event *events.DataSourceDeleted) error {
	return s.SQLStore.InTransaction(ctx, func(ctx context.Context) error {
		if err := s.deleteCorrelationsBySourceUID(ctx, DeleteCorrelationsBySourceUIDCommand{
			SourceUID: event.UID,
			OrgId:     event.OrgID,
		}); err != nil {
			return err
		}

		if err := s.deleteCorrelationsByTargetUID(ctx, DeleteCorrelationsByTargetUIDCommand{
			TargetUID: event.UID,
			OrgId:     event.OrgID,
		}); err != nil {
			return err
		}

		return nil
	})
}

func (s *CorrelationsK8sService) handleDatasourceDeletion(ctx context.Context, event *events.DataSourceDeleted) error {
	// TODO
	return nil
}

func (s *CorrelationsService) Usage(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	return s.CountCorrelations(ctx)
}

func (s *CorrelationsK8sService) Usage(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	// TODO
	return &quota.Map{}, nil
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

/*
NewCorrelationClientFromGenerator is blocking, so we can't run this in startup
and lazy load it on the first call instead
*/

func (s *CorrelationsK8sService) getK8sClient() (*v0alpha1.CorrelationClient, error) {
	s.k8sClientInitOnce.Do(func() {
		s.k8sClient, s.k8sClientInitErr = v0alpha1.NewCorrelationClientFromGenerator(s.clientGen)
	})
	return s.k8sClient, s.k8sClientInitErr
}
