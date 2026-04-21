package correlations

import (
	"context"
	"sync"

	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/apiserver/client"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var (
	logger = log.New("correlations")
)

type Service interface {
	GetCorrelation(ctx context.Context, cmd GetCorrelationQuery) (Correlation, error)
	GetCorrelations(ctx context.Context, cmd GetCorrelationsQuery) (GetCorrelationsResponseBody, error)
	CreateCorrelation(ctx context.Context, cmd CreateCorrelationCommand) (Correlation, error)
	UpdateCorrelation(ctx context.Context, cmd UpdateCorrelationCommand) (Correlation, error)
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

func (s CorrelationsService) GetCorrelations(ctx context.Context, cmd GetCorrelationsQuery) (GetCorrelationsResponseBody, error) {
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

// app platform service functions

type CorrelationsK8sService struct {
	RouteRegister     routing.RouteRegister
	log               log.Logger
	AccessControl     accesscontrol.AccessControl
	QuotaService      quota.Service
	k8sClientInitOnce sync.Once
	clientGen         resource.ClientGenerator
	k8sClient         client.K8sHandler
}

func (s *CorrelationsK8sService) CreateCorrelation(ctx context.Context, cmd CreateCorrelationCommand) (Correlation, error) {
	quotaReached, err := s.QuotaService.CheckQuotaReached(ctx, QuotaTargetSrv, nil)
	if err != nil {
		logger.Warn("Error getting correlation quota.", "error", err)
		return Correlation{}, ErrCorrelationsQuotaFailed
	}
	if quotaReached {
		return Correlation{}, ErrCorrelationsQuotaReached
	}

	correlation := Correlation{
		UID:         util.GenerateShortUID(),
		OrgID:       cmd.OrgId,
		SourceUID:   cmd.SourceUID,
		TargetUID:   cmd.TargetUID,
		Label:       cmd.Label,
		Description: cmd.Description,
		Config:      cmd.Config,
		Provisioned: cmd.Provisioned,
		Type:        cmd.Type,
	}

	corrSpec, err := convertCorrelationToUnstructured(correlation)
	if err != nil {
		return Correlation{}, err
	}

	appPlatformCorr, err := s.k8sClient.Create(ctx, corrSpec, cmd.OrgId, v1.CreateOptions{})
	if err != nil {
		return Correlation{}, err
	}
	strucCorr, err := convertUnstructuredToCorrelation(appPlatformCorr)
	if err != nil {
		return Correlation{}, err
	}
	legacyCorr, err := ToCorrelation(strucCorr)
	if err != nil {
		return Correlation{}, err
	}

	return *legacyCorr, nil
}

func (s *CorrelationsK8sService) DeleteCorrelation(ctx context.Context, cmd DeleteCorrelationCommand) error {
	return s.k8sClient.Delete(ctx, cmd.UID, cmd.OrgId, v1.DeleteOptions{})
}

func (s *CorrelationsK8sService) UpdateCorrelation(ctx context.Context, cmd UpdateCorrelationCommand) (Correlation, error) {
	correlation := Correlation{
		UID:         cmd.UID,
		OrgID:       cmd.OrgId,
		SourceUID:   cmd.SourceUID,
		Label:       *cmd.Label,
		Description: *cmd.Description,
		Config: CorrelationConfig{
			Field:           *cmd.Config.Field,
			Target:          *cmd.Config.Target,
			Transformations: cmd.Config.Transformations,
		},
		Type: *cmd.Type,
	}

	unstructCorr, err := convertCorrelationToUnstructured(correlation)
	if err != nil {
		return Correlation{}, err
	}

	returnedUnstructCorr, err := s.k8sClient.Update(ctx, unstructCorr, cmd.OrgId, v1.UpdateOptions{})
	if err != nil {
		return Correlation{}, err
	}

	returnedCorr, err := convertUnstructuredToCorrelation(returnedUnstructCorr)
	if err != nil {
		return Correlation{}, err
	}

	legacyCorr, err := ToCorrelation(returnedCorr)
	if err != nil {
		return Correlation{}, err
	}

	return *legacyCorr, nil
}

func (s *CorrelationsK8sService) GetCorrelation(ctx context.Context, cmd GetCorrelationQuery) (Correlation, error) {
	unstructCorr, err := s.k8sClient.Get(ctx, cmd.UID, cmd.OrgId, v1.GetOptions{}, "")
	if err != nil {
		return Correlation{}, err
	}
	appPlatformCorr, err := convertUnstructuredToCorrelation(unstructCorr)
	if err != nil {
		return Correlation{}, err
	}

	legacyCorr, err := ToCorrelation(appPlatformCorr)
	if err != nil {
		return Correlation{}, err
	}

	return *legacyCorr, nil
}

func (s *CorrelationsK8sService) GetCorrelationsBySourceUID(ctx context.Context, cmd GetCorrelationsBySourceUIDQuery) ([]Correlation, error) {
	// todo: we will need the datasource type here
	appPlatformCorrs, err := s.k8sClient.List(ctx, cmd.OrgId, v1.ListOptions{LabelSelector: "correlations.grafana.app/sourceDS-ref=" + cmd.SourceUID})
	if err != nil {
		return []Correlation{}, err
	}

	correlations := make([]Correlation, len(appPlatformCorrs.Items))

	for i, val := range appPlatformCorrs.Items {
		appPlatformCorr, err := convertUnstructuredToCorrelation(&val)
		if err != nil {
			return []Correlation{}, err
		}
		legacyCorr, err := ToCorrelation(appPlatformCorr)
		if err != nil {
			return []Correlation{}, err
		}
		correlations[i] = *legacyCorr
	}
	return correlations, nil
}

func (s *CorrelationsK8sService) GetCorrelations(ctx context.Context, cmd GetCorrelationsQuery) (GetCorrelationsResponseBody, error) {
	appPlatformCorrs, err := s.k8sClient.List(ctx, cmd.OrgId, v1.ListOptions{})
	if err != nil {
		return GetCorrelationsResponseBody{
			Correlations: []Correlation{},
		}, err
	}

	correlations := make([]Correlation, len(appPlatformCorrs.Items))

	for i, val := range appPlatformCorrs.Items {
		strucCorr, _ := convertUnstructuredToCorrelation(&val) // todo error handling
		legacyCorr, _ := ToCorrelation(strucCorr)              //TODO error handling here?
		correlations[i] = *legacyCorr
	}

	// TODO pagination

	return GetCorrelationsResponseBody{
		Correlations: correlations,
	}, nil
}

func (s *CorrelationsK8sService) DeleteCorrelationsBySourceUID(ctx context.Context, cmd DeleteCorrelationsBySourceUIDCommand) error {
	return s.k8sClient.DeleteCollection(ctx, cmd.OrgId, v1.ListOptions{LabelSelector: "correlations.grafana.app/sourceDS-ref=" + cmd.SourceUID})
}

func (s *CorrelationsK8sService) DeleteCorrelationsByTargetUID(ctx context.Context, cmd DeleteCorrelationsByTargetUIDCommand) error {
	return s.k8sClient.DeleteCollection(ctx, cmd.OrgId, v1.ListOptions{LabelSelector: "correlations.grafana.app/targetDS-ref=" + cmd.TargetUID})
}

// this handles deleting all correlations associated with a datasource, both as source and target, when the datasource itself is deleted.
func (s *CorrelationsK8sService) handleDatasourceDeletion(ctx context.Context, event *events.DataSourceDeleted) error {
	err := s.DeleteCorrelationsBySourceUID(ctx, DeleteCorrelationsBySourceUIDCommand{OrgId: event.OrgID, SourceUID: event.UID})
	if err != nil {
		return err
	}
	return s.DeleteCorrelationsByTargetUID(ctx, DeleteCorrelationsByTargetUIDCommand{OrgId: event.OrgID, TargetUID: event.UID})
}

// what's the best way to return just a count of records
func (s *CorrelationsK8sService) Usage(ctx context.Context, scopeParams *quota.ScopeParameters) (*quota.Map, error) {
	// TODO
	return &quota.Map{}, nil
}
