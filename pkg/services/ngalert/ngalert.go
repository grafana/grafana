package ngalert

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/services/quota"
	"golang.org/x/sync/errgroup"

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
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb"
)

const (
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
	DataProxy       *datasourceproxy.DatasourceProxyService `inject:""`
	QuotaService    *quota.QuotaService                     `inject:""`
	Metrics         *metrics.Metrics                        `inject:""`
	Alertmanager    *notifier.Alertmanager
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

	store := &store.DBstore{
		BaseInterval:           baseInterval,
		DefaultIntervalSeconds: ng.getRuleDefaultIntervalSeconds(),
		SQLStore:               ng.SQLStore,
		Logger:                 ng.Log,
	}

	var err error
	ng.Alertmanager, err = notifier.New(ng.Cfg, store, ng.Metrics)
	if err != nil {
		return err
	}

	schedCfg := schedule.SchedulerCfg{
		C:                      clock.New(),
		BaseInterval:           baseInterval,
		Logger:                 ng.Log,
		MaxAttempts:            int64(ng.Cfg.AlertingMaxAttempts),
		Evaluator:              eval.Evaluator{Cfg: ng.Cfg, Log: ng.Log},
		InstanceStore:          store,
		RuleStore:              store,
		Notifier:               ng.Alertmanager,
		Metrics:                ng.Metrics,
		MinRuleIntervalSeconds: ng.getRuleMinIntervalSeconds(),
	}
	ng.schedule = schedule.NewScheduler(schedCfg, ng.DataService, ng.Cfg.AppURL)

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

// Run starts the scheduler.
func (ng *AlertNG) Run(ctx context.Context) error {
	ng.Log.Debug("ngalert starting")
	ng.schedule.WarmStateCache(ng.stateManager)

	children, subCtx := errgroup.WithContext(ctx)

	if ng.Cfg.ExecuteAlerts {
		children.Go(func() error {
			return ng.schedule.Ticker(subCtx, ng.stateManager)
		})
	}
	children.Go(func() error {
		return ng.Alertmanager.Run(subCtx)
	})
	return children.Wait()
}

// IsDisabled returns true if the alerting service is disable for this instance.
func (ng *AlertNG) IsDisabled() bool {
	if ng.Cfg == nil {
		return true
	}
	return !ng.Cfg.IsNgAlertEnabled()
}

// getRuleDefaultIntervalSeconds returns the default rule interval if the interval is not set.
// If this constant (1 minute) is lower than the configured minimum evaluation interval then
// this configuration is returned.
func (ng *AlertNG) getRuleDefaultIntervalSeconds() int64 {
	ruleMinIntervalSeconds := ng.getRuleMinIntervalSeconds()
	if defaultIntervalSeconds < ruleMinIntervalSeconds {
		return ruleMinIntervalSeconds
	}
	return defaultIntervalSeconds
}

// getRuleMinIntervalSeconds returns the configured minimum rule interval.
// If this value is less or equal to zero or not divided exactly by the scheduler interval
// the scheduler interval (10 seconds) is returned.
func (ng *AlertNG) getRuleMinIntervalSeconds() int64 {
	if ng.Cfg.AlertingMinInterval <= 0 {
		return baseIntervalSeconds // if it's not configured; apply default
	}

	if ng.Cfg.AlertingMinInterval%baseIntervalSeconds != 0 {
		ng.Log.Error("Configured minimum evaluation interval is not divided exactly by the scheduler interval and it will fallback to default", "alertingMinInterval", ng.Cfg.AlertingMinInterval, "baseIntervalSeconds", baseIntervalSeconds, "defaultIntervalSeconds", defaultIntervalSeconds)
		return baseIntervalSeconds // if it's invalid; apply default
	}

	return ng.Cfg.AlertingMinInterval
}
