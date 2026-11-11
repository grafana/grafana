package store

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

// TimeNow makes it possible to test usage of time
var TimeNow = time.Now

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

// DBstore stores the Alertmanager configuration, admin configuration, alert instances and images.
// Rules and provenance have their own stores and are deliberately not re-exported here.
type DBstore struct {
	SQLStore db.DB
	Logger   log.Logger
}

func ProvideDBStore(sqlstore db.DB) (*DBstore, error) {
	store := DBstore{
		SQLStore: sqlstore,
		Logger:   log.New("ngalert.dbstore"),
	}
	return &store, nil
}
