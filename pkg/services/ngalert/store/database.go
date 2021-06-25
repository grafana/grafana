package store

import (
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// TimeNow makes it possible to test usage of time
var TimeNow = time.Now

// AlertDefinitionMaxTitleLength is the maximum length of the alert definition title
const AlertDefinitionMaxTitleLength = 190

// AlertingStore is the database interface used by the Alertmanager service.
type AlertingStore interface {
	GetLatestAlertmanagerConfiguration(*models.GetLatestAlertmanagerConfigurationQuery) error
	SaveAlertmanagerConfiguration(*models.SaveAlertmanagerConfigurationCmd) error
	SaveAlertmanagerConfigurationWithCallback(*models.SaveAlertmanagerConfigurationCmd, SaveCallback) error
}

// DBstore stores the alert definitions and instances in the database.
type DBstore struct {
	// the base scheduler tick rate; it's used for validating definition interval
	BaseInterval time.Duration
	// default alert definiiton interval
	DefaultIntervalSeconds int64
	SQLStore               *sqlstore.SQLStore
	Logger                 log.Logger
}
