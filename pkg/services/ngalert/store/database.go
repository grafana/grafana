package store

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
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
}

// DBstore stores the alert definitions and instances in the database.
type DBstore struct {
	Cfg              setting.UnifiedAlertingSettings
	SQLStore         *sqlstore.SQLStore
	Logger           log.Logger
	FolderService    dashboards.FolderService
	AccessControl    accesscontrol.AccessControl
	DashboardService dashboards.DashboardService
}

func ProvideDBStore(
	cfg *setting.Cfg, sqlstore *sqlstore.SQLStore, folderService dashboards.FolderService,
	access accesscontrol.AccessControl, dashboards dashboards.DashboardService) *DBstore {
	return &DBstore{
		Cfg:              cfg.UnifiedAlerting,
		SQLStore:         sqlstore,
		Logger:           log.New("dbstore"),
		FolderService:    folderService,
		AccessControl:    access,
		DashboardService: dashboards,
	}
}
