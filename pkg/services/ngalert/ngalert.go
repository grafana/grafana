package ngalert

import (
	"context"
	"fmt"
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
	maxAttempts              int64 = 3
	defaultIntervalInSeconds int64 = 60
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
	return nil
}

// Run starts the scheduler
func (ng *AlertNG) Run(ctx context.Context) error {
	ng.log.Debug("ngalert starting")
	ng.schedule = newScheduler(clock.New(), time.Second, ng.log, nil)
	return ng.alertingTicker(ctx)
}

// IsDisabled returns true if the alerting service is disable for this instance.
func (ng *AlertNG) IsDisabled() bool {
	if ng.Cfg == nil {
		return false
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

	alertDefinition := migrator.Table{
		Name: "alert_definition",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "condition", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "data", Type: migrator.DB_Text, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}, Type: migrator.IndexType},
		},
	}
	// create table
	mg.AddMigration("create alert_definition table", migrator.NewAddTableMigration(alertDefinition))

	// create indices
	mg.AddMigration("add index alert_definition org_id", migrator.NewAddIndexMigration(alertDefinition, alertDefinition.Indices[0]))

	now := timeNow()
	mg.AddMigration("add column updated", migrator.NewAddColumnMigration(alertDefinition, &migrator.Column{
		Name: "updated", Type: migrator.DB_BigInt, Nullable: false, Default: fmt.Sprintf("%d", now.Unix()),
	}))

	mg.AddMigration("add index alert_definition updated", migrator.NewAddIndexMigration(alertDefinition, &migrator.Index{
		Cols: []string{"updated"}, Type: migrator.IndexType,
	}))

	mg.AddMigration("add column interval", migrator.NewAddColumnMigration(alertDefinition, &migrator.Column{
		Name: "interval", Type: migrator.DB_BigInt, Nullable: false, Default: fmt.Sprintf("%d", defaultIntervalInSeconds),
	}))
}

// LoadAlertCondition returns a Condition object for the given alertDefinitionID.
func (ng *AlertNG) LoadAlertCondition(alertDefinitionID int64) (*eval.Condition, error) {
	getAlertDefinitionByIDQuery := getAlertDefinitionByIDQuery{ID: alertDefinitionID}
	if err := ng.getAlertDefinitionByID(&getAlertDefinitionByIDQuery); err != nil {
		return nil, err
	}
	alertDefinition := getAlertDefinitionByIDQuery.Result

	err := ng.validateAlertDefinition(alertDefinition, true)
	if err != nil {
		return nil, err
	}

	return &eval.Condition{
		RefID:                 alertDefinition.Condition,
		QueriesAndExpressions: alertDefinition.Data,
	}, nil
}
