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
	addAlertDefinitionMigrations(mg)
	addAlertDefinitionVersionMigrations(mg)
}

func addAlertDefinitionMigrations(mg *migrator.Migrator) {
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

	mg.AddMigration("add column version", migrator.NewAddColumnMigration(alertDefinition, &migrator.Column{
		Name: "version", Type: migrator.DB_Int, Nullable: false, Default: "0",
	}))
}

func addAlertDefinitionVersionMigrations(mg *migrator.Migrator) {
	alertDefinitionVersion := migrator.Table{
		Name: "alert_definition_version",
		Columns: []*migrator.Column{
			{Name: "id", Type: migrator.DB_BigInt, IsPrimaryKey: true, IsAutoIncrement: true},
			{Name: "alert_definition_id", Type: migrator.DB_BigInt},
			{Name: "parent_version", Type: migrator.DB_Int, Nullable: false},
			{Name: "restored_from", Type: migrator.DB_Int, Nullable: false},
			{Name: "version", Type: migrator.DB_Int, Nullable: false},
			{Name: "created", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "name", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "condition", Type: migrator.DB_NVarchar, Length: 255, Nullable: false},
			{Name: "data", Type: migrator.DB_Text, Nullable: false},
			{Name: "interval", Type: migrator.DB_BigInt, Nullable: false},
		},
		Indices: []*migrator.Index{
			{Cols: []string{"alert_definition_id", "version"}, Type: migrator.UniqueIndex},
		},
	}
	mg.AddMigration("create alert_definition_version table v1", migrator.NewAddTableMigration(alertDefinitionVersion))
	mg.AddMigration("add unique index alert_definition_version.alert_definition_id and versionn", migrator.NewAddIndexMigration(alertDefinitionVersion, alertDefinitionVersion.Indices[0]))

	const rawSQL = `INSERT INTO alert_definition_version
	(
		alert_definition_id,
		version,
		parent_version,
		restored_from,
		created,
		name,
		condition,
		data,
		interval
	)
	SELECT
		alert_definition.id,
		alert_definition.version,
		alert_definition.version,
		alert_definition.version,
		alert_definition.updated,
		alert_definition.name,
		alert_definition.condition,
		alert_definition.data,
		alert_definition.interval
	FROM alert_definition;`
	mg.AddMigration("save existing alert_definition data in alert_definition_version table v1", migrator.NewRawSQLMigration(rawSQL))

	const setVersionTo1WhereZeroSQL = `UPDATE alert_definition SET version = 1 WHERE version = 0`
	mg.AddMigration("Set alert_definition version to 1 where 0", migrator.NewRawSQLMigration(setVersionTo1WhereZeroSQL))
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
		OrgID:                 alertDefinition.OrgID,
		QueriesAndExpressions: alertDefinition.Data,
	}, nil
}
