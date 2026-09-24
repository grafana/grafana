package store

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
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

// DBstore stores the Alertmanager configuration, admin configuration, alert instances and images
// in the database. Alert rules live in ngalert/store/rules and provisioning provenance lives in
// ngalert/store/provenance; neither is re-exported here on purpose, so that every caller names the
// store it actually depends on.
type DBstore struct {
	// FeatureToggles has no use inside this package, but is read by callers that only hold a
	// DBstore.
	// TODO(rule-store-split): inject featuremgmt.FeatureToggles into
	// pkg/services/provisioning.ProvisioningServiceImpl directly and drop this field.
	FeatureToggles featuremgmt.FeatureToggles
	SQLStore       db.DB
	Logger         log.Logger
}

func ProvideDBStore(
	featureToggles featuremgmt.FeatureToggles,
	sqlstore db.DB,
) (*DBstore, error) {
	store := DBstore{
		FeatureToggles: featureToggles,
		SQLStore:       sqlstore,
		Logger:         log.New("ngalert.dbstore"),
	}
	return &store, nil
}
