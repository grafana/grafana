package ngalert

import (
	"context"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	maxAttempts int64 = 3
	// scheduler interval
	// changing this value is discouraged
	// because this could cause existing alert definition
	// with intervals that are not exactly divided by this number
	// not to be evaluated
	baseIntervalSeconds = 10
	// default alert definiiton interval
	defaultIntervalSeconds int64 = 6 * baseIntervalSeconds
)

// AlertNG is the service for evaluating the condition of an alert definition.
type AlertNG struct {
	Cfg             *setting.Cfg             `inject:""`
	DatasourceCache datasources.CacheService `inject:""`
	RouteRegister   routing.RouteRegister    `inject:""`
	SQLStore        *sqlstore.SQLStore       `inject:""`
	log             log.Logger
	schedule        *schedule
}

func init() {
	registry.RegisterService(&AlertNG{})
}

// Init initializes the AlertingService.
func (ng *AlertNG) Init() error {
	ng.log = log.New("ngalert")

	ng.registerAPIEndpoints()
	ng.schedule = newScheduler(clock.New(), baseIntervalSeconds*time.Second, ng.log, nil)
	return nil
}

// Run starts the scheduler
func (ng *AlertNG) Run(ctx context.Context) error {
	ng.log.Debug("ngalert starting")
	return ng.alertingTicker(ctx)
}

// IsDisabled returns true if the alerting service is disable for this instance.
func (ng *AlertNG) IsDisabled() bool {
	if ng.Cfg == nil {
		return true
	}
	// Check also about expressions?
	return !ng.Cfg.IsNgAlertEnabled()
}

// AddMigration defines database migrations.
// If Alerting NG is not enabled does nothing.
func (ng *AlertNG) AddMigration(mg *migrator.Migrator) {
	if ng.IsDisabled() {
		return
	}
	addAlertDefinitionMigrations(mg)
	addAlertDefinitionVersionMigrations(mg)
	// Create alert_instance table
	alertInstanceMigration(mg)
}

// LoadAlertCondition returns a Condition object for the given alertDefinitionID.
func (ng *AlertNG) LoadAlertCondition(alertDefinitionUID string, orgID int64) (*eval.Condition, error) {
	q := getAlertDefinitionByUIDQuery{UID: alertDefinitionUID, OrgID: orgID}
	if err := ng.getAlertDefinitionByUID(&q); err != nil {
		return nil, err
	}
	alertDefinition := q.Result

	err := ng.validateAlertDefinition(alertDefinition, true)
	if err != nil {
		return nil, err
	}

	return &eval.Condition{
		RefID:                 alertDefinition.Condition,
		OrgID:                 alertDefinition.OrgID,
		QueriesAndExpressions: alertDefinition.Data,
	}, nil
}
