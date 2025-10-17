package store

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/setting"
)

// TimeNow makes it possible to test usage of time
var TimeNow = time.Now

// AlertDefinitionMaxTitleLength is the maximum length of the alert definition title
const AlertDefinitionMaxTitleLength = 190

// AlertingStore is the database interface used by the Alertmanager service.
type AlertingStore interface {
	GetLatestAlertmanagerConfiguration(ctx context.Context, orgID int64) (*models.AlertConfiguration, error)
	GetAllLatestAlertmanagerConfiguration(ctx context.Context) ([]*models.AlertConfiguration, error)
	SaveAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
	SaveAlertmanagerConfigurationWithCallback(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd, callback SaveCallback) error
	UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
	MarkConfigurationAsApplied(ctx context.Context, cmd *models.MarkConfigurationAsAppliedCmd) error
	GetAppliedConfigurations(ctx context.Context, orgID int64, limit int) ([]*models.HistoricAlertConfiguration, error)
	GetHistoricalConfiguration(ctx context.Context, orgID int64, id int64) (*models.HistoricAlertConfiguration, error)
}

// DBstore stores the alert definitions and instances in the database.
type DBstore struct {
	Cfg              setting.UnifiedAlertingSettings
	FeatureToggles   featuremgmt.FeatureToggles
	SQLStore         db.DB
	Logger           log.Logger
	FolderService    folder.Service
	DashboardService dashboards.DashboardService
	AccessControl    accesscontrol.AccessControl
	Bus              bus.Bus
	// Deprecated: Use AlertRuleCache instead
	CacheService *localcache.CacheService
	// AlertRuleCache is the cache implementation for alert rules (can be local or remote)
	AlertRuleCache AlertRuleCache
}

func ProvideDBStore(
	cfg *setting.Cfg,
	featureToggles featuremgmt.FeatureToggles,
	sqlstore db.DB,
	folderService folder.Service,
	dashboards dashboards.DashboardService,
	ac accesscontrol.AccessControl,
	bus bus.Bus,
	cacheService *localcache.CacheService,
	alertRuleCache AlertRuleCache,
) (*DBstore, error) {
	logger := log.New("ngalert.dbstore")
	store := DBstore{
		Cfg:              cfg.UnifiedAlerting,
		FeatureToggles:   featureToggles,
		SQLStore:         sqlstore,
		Logger:           logger,
		FolderService:    folderService,
		DashboardService: dashboards,
		AccessControl:    ac,
		Bus:              bus,
		CacheService:     cacheService, // Kept for backward compatibility
		AlertRuleCache:   alertRuleCache,
	}
	if err := folderService.RegisterService(store); err != nil {
		return nil, err
	}
	return &store, nil
}

type RuleChangeEvent struct {
	RuleKeys []models.AlertRuleKey
}
