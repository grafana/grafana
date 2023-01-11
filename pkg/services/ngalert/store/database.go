package store

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
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
	GetLatestAlertmanagerConfiguration(ctx context.Context, query *models.GetLatestAlertmanagerConfigurationQuery) error
	GetAllLatestAlertmanagerConfiguration(ctx context.Context) ([]*models.AlertConfiguration, error)
	SaveAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
	SaveAlertmanagerConfigurationWithCallback(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd, callback SaveCallback) error
	UpdateAlertmanagerConfiguration(ctx context.Context, cmd *models.SaveAlertmanagerConfigurationCmd) error
	MarkConfigurationAsApplied(ctx context.Context, cmd *models.MarkConfigurationAsAppliedCmd) error
}

// DBstore stores the alert definitions and instances in the database.
type DBstore struct {
	Cfg              setting.UnifiedAlertingSettings
	FeatureToggles   featuremgmt.FeatureToggles
	SQLStore         db.DB
	Logger           log.Logger
	FolderService    folder.Service
	AccessControl    accesscontrol.AccessControl
	DashboardService dashboards.DashboardService
}

func ProvideDBStore(
	cfg *setting.Cfg, featureToggles featuremgmt.FeatureToggles, sqlstore db.DB, folderService folder.Service,
	access accesscontrol.AccessControl, dashboards dashboards.DashboardService) *DBstore {
	return &DBstore{
		Cfg:              cfg.UnifiedAlerting,
		FeatureToggles:   featureToggles,
		SQLStore:         sqlstore,
		Logger:           log.New("dbstore"),
		FolderService:    folderService,
		AccessControl:    access,
		DashboardService: dashboards,
	}
}
