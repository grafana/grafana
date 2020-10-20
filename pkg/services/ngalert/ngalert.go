package ngalert

import (
	"errors"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/tsdb"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
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
	Bus             bus.Bus                  `inject:""`
	Cfg             *setting.Cfg             `inject:""`
	DatasourceCache datasources.CacheService `inject:""`
	RouteRegister   routing.RouteRegister    `inject:""`
	SQLStore        *sqlstore.SqlStore       `inject:""`
	log             log.Logger
}

func init() {
	registry.RegisterService(&AlertNG{})
}

// Init initializes the AlertingService.
func (ng *AlertNG) Init() error {
	ng.log = log.New("ngalert")

	ng.registerAPIEndpoints()
	ng.registerBusHandlers()

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
	}
	// create table
	mg.AddMigration("create alert_definition table", migrator.NewAddTableMigration(alertDefinition))
}

// LoadAlertCondition returns a Condition object for the given alertDefintionId.
func (ng *AlertNG) LoadAlertCondition(alertDefinitionID int64, signedInUser *models.SignedInUser, skipCache bool) (*eval.Condition, error) {
	getAlertDefinitionByIDQuery := GetAlertDefinitionByIDQuery{ID: alertDefinitionID}
	if err := bus.Dispatch(&getAlertDefinitionByIDQuery); err != nil {
		return nil, err
	}
	alertDefinition := getAlertDefinitionByIDQuery.Result

	condition := eval.Condition{RefID: alertDefinition.Condition}
	var ds *models.DataSource
	for _, query := range alertDefinition.Data {
		dsName := query.Model.Get("datasource").MustString("")
		if dsName != "__expr__" {
			datasourceID, err := query.Model.Get("datasourceId").Int64()
			if err != nil {
				return nil, err
			}

			ds, err = ng.DatasourceCache.GetDatasource(datasourceID, signedInUser, skipCache)
			if err != nil {
				return nil, err
			}
		}

		if ds == nil && dsName != "__expr__" {
			return nil, errors.New("No datasource reference found")
		}

		if dsName == "" {
			query.Model.Set("datasource", ds.Name)
		}

		if query.Model.Get("datasourceId").MustInt64() == 0 {
			query.Model.Set("datasourceId", ds.Id)
		}

		if query.Model.Get("orgId").MustInt64() == 0 { // GEL requires orgID inside the query JSON
			query.Model.Set("orgId", alertDefinition.OrgId)
		}

		if query.Model.Get("maxDataPoints").MustInt64() == 0 { // GEL requires maxDataPoints inside the query JSON
			query.Model.Set("maxDataPoints", 100)
		}

		// intervalMS is calculated by the frontend
		// should we do something similar?
		if query.Model.Get("intervalMs").MustInt64() == 0 { // GEL requires intervalMs inside the query JSON
			query.Model.Set("intervalMs", 1000)
		}

		condition.QueriesAndExpressions = append(condition.QueriesAndExpressions, tsdb.Query{
			RefId:         query.RefId,
			MaxDataPoints: query.Model.Get("maxDataPoints").MustInt64(100),
			IntervalMs:    query.Model.Get("intervalMs").MustInt64(1000),
			QueryType:     query.Model.Get("queryType").MustString(""),
			Model:         query.Model,
			DataSource:    ds,
		})
	}

	return &condition, nil
}
