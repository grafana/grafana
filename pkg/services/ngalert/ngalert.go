package ngalert

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/ngalert/eval"

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
		Indices: []*migrator.Index{
			{Cols: []string{"org_id"}, Type: migrator.IndexType},
		},
	}
	// create table
	mg.AddMigration("create alert_definition table", migrator.NewAddTableMigration(alertDefinition))

	// create indices
	mg.AddMigration("add index alert_definition org_id", migrator.NewAddIndexMigration(alertDefinition, alertDefinition.Indices[0]))
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
		model := make(map[string]interface{})
		err := json.Unmarshal(query.JSON, &model)
		if err != nil {
			return nil, fmt.Errorf("failed to unmarshal query model %w", err)
		}

		i := model["datasource"]
		dsName, _ := i.(string)
		if dsName != "__expr__" {
			i, ok := model["datasourceId"]
			if !ok {
				return nil, fmt.Errorf("failed to get datasourceId from query model")
			}
			datasourceID, ok := i.(float64)
			if !ok {
				return nil, fmt.Errorf("failed to cast datasourceId to int64")
			}

			ds, err = ng.DatasourceCache.GetDatasource(int64(datasourceID), signedInUser, skipCache)
			if err != nil {
				return nil, err
			}
		} else {
			ds = &models.DataSource{Name: dsName, Id: -100}
		}

		if ds == nil && dsName != "__expr__" {
			return nil, fmt.Errorf("no datasource reference found")
		}

		if dsName == "" {
			model["datasource"] = ds.Name
		}

		i, ok := model["datasourceId"]
		if !ok {
			model["datasourceId"] = ds.Id
		} else {
			datasourceID, ok := i.(int64)
			if !ok || datasourceID == 0 {
				model["datasourceId"] = ds.Id
			}
		}

		i, ok = model["orgId"] // GEL requires orgID inside the query JSON
		if !ok {
			model["orgId"] = alertDefinition.OrgId
		} else {
			orgID, ok := i.(int64)
			if !ok || orgID == 0 {
				model["orgId"] = alertDefinition.OrgId
			}
		}

		const defaultMaxDataPoints = 100
		var maxDataPoints int64
		i, ok = model["maxDataPoints"] // GEL requires maxDataPoints inside the query JSON
		if !ok {
			maxDataPoints = defaultMaxDataPoints
		} else {
			maxDataPoints, ok = i.(int64)
			if !ok || maxDataPoints == 0 {
				maxDataPoints = defaultMaxDataPoints
			}
		}
		query.MaxDataPoints = maxDataPoints

		// intervalMS is calculated by the frontend
		// should we do something similar?
		const defaultIntervalMs = 1000
		var intervalMs int64
		i, ok = model["intervalMs"] // GEL requires intervalMs inside the query JSON
		if !ok {
			intervalMs = defaultIntervalMs
		} else {
			intervalMs, ok = i.(int64)
			if !ok || i == 0 {
				intervalMs = defaultIntervalMs
			}
		}
		query.Interval = time.Duration(intervalMs) * time.Millisecond

		if query.JSON, err = json.Marshal(model); err != nil {
			return nil, fmt.Errorf("unable to marshal query model %w", err)
		}
		condition.QueriesAndExpressions = append(condition.QueriesAndExpressions, query)
	}

	return &condition, nil
}
