package ngalert

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
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
	/*
		if ng.IsDisabled() {
			return
		}
	*/

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

// AlertExecCtx is the context provided for executing an alert condition.§
type AlertExecCtx struct {
	AlertDefitionID int64
	SignedInUser    *models.SignedInUser

	Ctx context.Context
}

// LoadAlertCondition returns a Condition object for the given alertDefintionId.
func (ng *AlertNG) LoadAlertCondition(dashboardID int64, panelID int64, conditionRefID string, signedInUser *models.SignedInUser, skipCache bool) (*Condition, error) {
	// get queries from the dashboard (because GEL expressions cannot be stored in alerts so far)
	getDashboardQuery := models.GetDashboardQuery{Id: dashboardID}
	if err := bus.Dispatch(&getDashboardQuery); err != nil {
		return nil, err
	}

	blob, err := getDashboardQuery.Result.Data.MarshalJSON()
	if err != nil {
		return nil, errors.New("Failed to marshal dashboard JSON")
	}
	var dash minimalDashboard
	err = json.Unmarshal(blob, &dash)
	if err != nil {
		return nil, errors.New("Failed to unmarshal dashboard JSON")
	}

	condition := Condition{}
	for _, p := range dash.Panels {
		if p.ID == panelID {
			panelDatasource := p.Datasource
			var ds *models.DataSource
			for i, query := range p.Targets {
				refID := query.Get("refId").MustString("A")
				queryDatasource := query.Get("datasource").MustString()

				if i == 0 && queryDatasource != "__expr__" {
					dsName := panelDatasource
					if queryDatasource != "" {
						dsName = queryDatasource
					}

					getDataSourceByNameQuery := models.GetDataSourceByNameQuery{Name: dsName, OrgId: getDashboardQuery.Result.OrgId}
					if err := bus.Dispatch(&getDataSourceByNameQuery); err != nil {
						return nil, err
					}

					ds, err = ng.DatasourceCache.GetDatasource(getDataSourceByNameQuery.Result.Id, signedInUser, skipCache)
					if err != nil {
						return nil, err
					}
				}

				if ds == nil {
					return nil, errors.New("No datasource reference found")
				}

				if queryDatasource == "" {
					query.Set("datasource", ds.Name)
				}

				if query.Get("datasourceId").MustString() == "" {
					query.Set("datasourceId", ds.Id)
				}

				if query.Get("orgId").MustString() == "" { // GEL requires orgID inside the query JSON
					// need to decide which organization id is expected there
					// in grafana queries is passed the signed in user organization id:
					// https://github.com/grafana/grafana/blob/34a355fe542b511ed02976523aa6716aeb00bde6/packages/grafana-runtime/src/utils/DataSourceWithBackend.ts#L60
					// but I think that it should be datasource org id instead
					query.Set("orgId", 0)
				}

				if query.Get("maxDataPoints").MustString() == "" { // GEL requires maxDataPoints inside the query JSON
					query.Set("maxDataPoints", 100)
				}

				// intervalMS is calculated by the frontend
				// should we do something similar?
				if query.Get("intervalMs").MustString() == "" { // GEL requires intervalMs inside the query JSON
					query.Set("intervalMs", 1000)
				}

				condition.QueriesAndExpressions = append(condition.QueriesAndExpressions, tsdb.Query{
					RefId:         refID,
					MaxDataPoints: query.Get("maxDataPoints").MustInt64(100),
					IntervalMs:    query.Get("intervalMs").MustInt64(1000),
					QueryType:     query.Get("queryType").MustString(""),
					Model:         query,
					DataSource:    ds,
				})
			}
		}
	}
	condition.RefID = conditionRefID
	return &condition, nil
}
