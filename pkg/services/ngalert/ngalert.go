package ngalert

import (
	"github.com/grafana/grafana/pkg/services/ngalert/eval"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
)

// AlertNG is the service for evaluating the condition of an alert definition.
type AlertNG struct {
	Cfg             *setting.Cfg             `inject:""`
	DatasourceCache datasources.CacheService `inject:""`
	RouteRegister   routing.RouteRegister    `inject:""`
	SQLStore        *sqlstore.SQLStore       `inject:""`
	log             log.Logger
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

	alertInstance := migrator.Table{
		Name: "alert_instance",
		Columns: []*migrator.Column{
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "alert_definition_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "labels", Type: migrator.DB_Text, Nullable: false},
			{Name: "labels_hash", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "current_state", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "current_state_since", Type: migrator.DB_DateTime, Nullable: false},
			{Name: "last_eval_time", Type: migrator.DB_DateTime, Nullable: false},
		},
		PrimaryKeys: []string{"alert_definition_id", "labels_hash"},
	}

	// create table
	mg.AddMigration("create alert_instance table", migrator.NewAddTableMigration(alertInstance))

}

// LoadAlertCondition returns a Condition object for the given alertDefinitionID.
func (ng *AlertNG) LoadAlertCondition(alertDefinitionID int64, signedInUser *models.SignedInUser, skipCache bool) (*eval.Condition, error) {
	getAlertDefinitionByIDQuery := getAlertDefinitionByIDQuery{ID: alertDefinitionID}
	if err := ng.getAlertDefinitionByID(&getAlertDefinitionByIDQuery); err != nil {
		return nil, err
	}
	alertDefinition := getAlertDefinitionByIDQuery.Result

	err := ng.validateAlertDefinition(alertDefinition, signedInUser, skipCache)
	if err != nil {
		return nil, err
	}

	return &eval.Condition{
		RefID:                 alertDefinition.Condition,
		QueriesAndExpressions: alertDefinition.Data,
	}, nil
}
