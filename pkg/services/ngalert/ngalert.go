package ngalert

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/quota"

	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/state"

	"github.com/benbjohnson/clock"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/ngalert/api"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
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
	Cfg             *setting.Cfg                            `inject:""`
	DatasourceCache datasources.CacheService                `inject:""`
	RouteRegister   routing.RouteRegister                   `inject:""`
	SQLStore        *sqlstore.SQLStore                      `inject:""`
	DataService     *tsdb.Service                           `inject:""`
	Alertmanager    *notifier.Alertmanager                  `inject:""`
	DataProxy       *datasourceproxy.DatasourceProxyService `inject:""`
	QuotaService    *quota.QuotaService                     `inject:""`
	Metrics         *metrics.Metrics                        `inject:""`
	Log             log.Logger
	schedule        schedule.ScheduleService
	stateManager    *state.Manager
}

func init() {
	registry.RegisterService(&AlertNG{})
}

// Init initializes the AlertingService.
func (ng *AlertNG) Init() error {
	ng.Log = log.New("ngalert")
	ng.stateManager = state.NewManager(ng.Log, ng.Metrics)
	baseInterval := baseIntervalSeconds * time.Second

	store := store.DBstore{BaseInterval: baseInterval, DefaultIntervalSeconds: defaultIntervalSeconds, SQLStore: ng.SQLStore}

	schedCfg := schedule.SchedulerCfg{
		C:             clock.New(),
		BaseInterval:  baseInterval,
		Logger:        ng.Log,
		MaxAttempts:   maxAttempts,
		Evaluator:     eval.Evaluator{Cfg: ng.Cfg},
		InstanceStore: store,
		RuleStore:     store,
		Notifier:      ng.Alertmanager,
	}
	ng.schedule = schedule.NewScheduler(schedCfg, ng.DataService)

	api := api.API{
		Cfg:             ng.Cfg,
		DatasourceCache: ng.DatasourceCache,
		RouteRegister:   ng.RouteRegister,
		DataService:     ng.DataService,
		Schedule:        ng.schedule,
		DataProxy:       ng.DataProxy,
		QuotaService:    ng.QuotaService,
		InstanceStore:   store,
		RuleStore:       store,
		AlertingStore:   store,
		Alertmanager:    ng.Alertmanager,
		StateManager:    ng.stateManager,
	}
	api.RegisterAPIEndpoints(ng.Metrics)

	return nil
}

// Run starts the scheduler
func (ng *AlertNG) Run(ctx context.Context) error {
	ng.Log.Debug("ngalert starting")
	ng.schedule.WarmStateCache(ng.stateManager)
	return ng.schedule.Ticker(ctx, ng.stateManager)
}

// IsDisabled returns true if the alerting service is disable for this instance.
func (ng *AlertNG) IsDisabled() bool {
	if ng.Cfg == nil {
		return true
	}
	return !ng.Cfg.IsNgAlertEnabled()
}

// AddMigration defines database migrations.
// If Alerting NG is not enabled does nothing.
func (ng *AlertNG) AddMigration(mg *migrator.Migrator) {
	if ng.IsDisabled() {
		return
	}
	store.AddAlertDefinitionMigrations(mg, defaultIntervalSeconds)
	store.AddAlertDefinitionVersionMigrations(mg)
	// Create alert_instance table
	store.AlertInstanceMigration(mg)

	// Create alert_rule
	store.AddAlertRuleMigrations(mg, defaultIntervalSeconds)
	store.AddAlertRuleVersionMigrations(mg)
}
