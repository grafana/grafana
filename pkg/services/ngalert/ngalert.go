package ngalert

import (
	"context"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/sqlstore"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
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
	schedule        scheduleService
	definitionStore definitionStore
	instanceStore   instanceStore
}

func init() {
	/*
		var g inject.Graph
		var store storeServiceImpl
		var ng AlertNG
		g.Provide(
			&inject.Object{Value: &store},
		)
		g.Populate()
		ng.DefinitionStore = store
		ng.InstanceStore = store
	*/
	registry.RegisterService(&AlertNG{})
}

// Init initializes the AlertingService.
func (ng *AlertNG) Init() error {
	ng.log = log.New("ngalert")

	baseInterval := baseIntervalSeconds * time.Second

	store := storeImpl{baseInterval: baseInterval, SQLStore: ng.SQLStore}
	ng.definitionStore = store
	ng.instanceStore = store

	schedCfg := schedulerCfg{
		c:               clock.New(),
		baseInterval:    baseInterval,
		logger:          ng.log,
		evaluator:       eval.Evaluator{Cfg: ng.Cfg},
		definitionStore: store,
		instanceStore:   store,
	}
	ng.schedule = newScheduler(schedCfg)

	ng.registerAPIEndpoints()
	return nil
}

// Run starts the scheduler
func (ng *AlertNG) Run(ctx context.Context) error {
	ng.log.Debug("ngalert starting")
	return ng.schedule.Ticker(ctx)
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
	if err := ng.definitionStore.getAlertDefinitionByUID(&q); err != nil {
		return nil, err
	}
	alertDefinition := q.Result

	err := ng.definitionStore.validateAlertDefinition(alertDefinition, true)
	if err != nil {
		return nil, err
	}

	return &eval.Condition{
		RefID:                 alertDefinition.Condition,
		OrgID:                 alertDefinition.OrgID,
		QueriesAndExpressions: alertDefinition.Data,
	}, nil
}
