package store

import (
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/models"

	"github.com/grafana/grafana/pkg/services/sqlstore"
)

// TimeNow makes it possible to test usage of time
var TimeNow = time.Now

// AlertDefinitionMaxTitleLength is the maximum length of the alert definition title
const AlertDefinitionMaxTitleLength = 190

// Store is the interface for persisting alert definitions and instances
type Store interface {
	GetAlertInstance(*models.GetAlertInstanceQuery) error
	ListAlertInstances(*models.ListAlertInstancesQuery) error
	SaveAlertInstance(*models.SaveAlertInstanceCommand) error
	FetchOrgIds(cmd *models.FetchUniqueOrgIdsQuery) error
}

// AlertingStore is the database interface used by the Alertmanager service.
type AlertingStore interface {
	GetLatestAlertmanagerConfiguration(*models.GetLatestAlertmanagerConfigurationQuery) error
	GetAlertmanagerConfiguration(*models.GetAlertmanagerConfigurationQuery) error
	SaveAlertmanagerConfiguration(*models.SaveAlertmanagerConfigurationCmd) error
}

// DBstore stores the alert definitions and instances in the database.
type DBstore struct {
	// the base scheduler tick rate; it's used for validating definition interval
	BaseInterval time.Duration
	// default alert definiiton interval
	DefaultIntervalSeconds int64
	SQLStore               *sqlstore.SQLStore `inject:""`
}
