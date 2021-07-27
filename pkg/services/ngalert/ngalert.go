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
	maxAttempts int64 = 3
	// scheduler interval
	// changing this value is discouraged
	// because this could cause existing alert definition
	// with intervals that are not exactly divided by this number
	// not to be evaluated
	defaultBaseIntervalSeconds = 10
	// default alert definition interval
	defaultIntervalSeconds int64 = 6 * defaultBaseIntervalSeconds
)

func ProvideService(cfg *setting.Cfg, dataSourceCache datasources.CacheService, routeRegister routing.RouteRegister,
	sqlStore *sqlstore.SQLStore, dataService *tsdb.Service, dataProxy *datasourceproxy.DataSourceProxyService,
	quotaService *quota.QuotaService, m *metrics.Metrics) (*AlertNG, error) {
	baseInterval := cfg.AlertingBaseInterval
	if baseInterval <= 0 {
		baseInterval = defaultBaseIntervalSeconds
	}
	baseInterval *= time.Second
	logger := log.New("ngalert")
	store := &store.DBstore{
		BaseInterval:           baseInterval,
		DefaultIntervalSeconds: defaultIntervalSeconds,
		SQLStore:               sqlStore,
		Logger:                 logger,
	}

	alertmanager, err := notifier.New(cfg, store, m)
	if err != nil {
		return nil, err
	}

	schedCfg := schedule.SchedulerCfg{
		C:             clock.New(),
		BaseInterval:  baseInterval,
		Logger:        logger,
		MaxAttempts:   maxAttempts,
		Evaluator:     eval.Evaluator{Cfg: cfg, Log: logger},
		InstanceStore: store,
		RuleStore:     store,
		Notifier:      alertmanager,
		Metrics:       m,
	}
	stateManager := state.NewManager(logger, m, store, store)
	schedule := schedule.NewScheduler(schedCfg, dataService, cfg.AppURL, stateManager)

	ng := &AlertNG{
		Cfg:             cfg,
		DataSourceCache: dataSourceCache,
		RouteRegister:   routeRegister,
		SQLStore:        sqlStore,
		DataService:     dataService,
		DataProxy:       dataProxy,
		QuotaService:    quotaService,
		Metrics:         m,
		Log:             logger,
		Alertmanager:    alertmanager,
		stateManager:    stateManager,
		schedule:        schedule,
	}
	api := api.API{
		Cfg:             ng.Cfg,
		DatasourceCache: ng.DataSourceCache,
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

	return ng, nil
}

// AlertNG is the service for evaluating the condition of an alert definition.
type AlertNG struct {
	Cfg             *setting.Cfg
	DataSourceCache datasources.CacheService
	RouteRegister   routing.RouteRegister
	SQLStore        *sqlstore.SQLStore
	DataService     *tsdb.Service
	DataProxy       *datasourceproxy.DataSourceProxyService
	QuotaService    *quota.QuotaService
	Metrics         *metrics.Metrics
	Alertmanager    *notifier.Alertmanager
	Log             log.Logger
	schedule        schedule.ScheduleService
	stateManager    *state.Manager
}

// Run starts the scheduler and Alertmanager.
func (ng *AlertNG) Run(ctx context.Context) error {
	ng.Log.Debug("ngalert starting")
	ng.stateManager.Warm()

	children, subCtx := errgroup.WithContext(ctx)
	children.Go(func() error {
		return ng.schedule.Run(subCtx)
	})
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
