package ngalert

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/benbjohnson/clock"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/api"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/image"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(
	cfg *setting.Cfg,
	featureToggles featuremgmt.FeatureToggles,
	dataSourceCache datasources.CacheService,
	dataSourceService datasources.DataSourceService,
	routeRegister routing.RouteRegister,
	sqlStore db.DB,
	kvStore kvstore.KVStore,
	expressionService *expr.Service,
	dataProxy *datasourceproxy.DataSourceProxyService,
	quotaService quota.Service,
	secretsService secrets.Service,
	notificationService notifications.Service,
	m *metrics.NGAlert,
	folderService folder.Service,
	ac accesscontrol.AccessControl,
	dashboardService dashboards.DashboardService,
	renderService rendering.Service,
	bus bus.Bus,
	accesscontrolService accesscontrol.Service,
	annotationsRepo annotations.Repository,
	pluginsStore plugins.Store,
	tracer tracing.Tracer,
) (*AlertNG, error) {
	ng := &AlertNG{
		Cfg:                  cfg,
		FeatureToggles:       featureToggles,
		DataSourceCache:      dataSourceCache,
		DataSourceService:    dataSourceService,
		RouteRegister:        routeRegister,
		SQLStore:             sqlStore,
		KVStore:              kvStore,
		ExpressionService:    expressionService,
		DataProxy:            dataProxy,
		QuotaService:         quotaService,
		SecretsService:       secretsService,
		Metrics:              m,
		Log:                  log.New("ngalert"),
		NotificationService:  notificationService,
		folderService:        folderService,
		accesscontrol:        ac,
		dashboardService:     dashboardService,
		renderService:        renderService,
		bus:                  bus,
		accesscontrolService: accesscontrolService,
		annotationsRepo:      annotationsRepo,
		pluginsStore:         pluginsStore,
		tracer:               tracer,
	}

	if ng.IsDisabled() {
		return ng, nil
	}

	if err := ng.init(); err != nil {
		return nil, err
	}

	return ng, nil
}

// AlertNG is the service for evaluating the condition of an alert definition.
type AlertNG struct {
	Cfg                 *setting.Cfg
	FeatureToggles      featuremgmt.FeatureToggles
	DataSourceCache     datasources.CacheService
	DataSourceService   datasources.DataSourceService
	RouteRegister       routing.RouteRegister
	SQLStore            db.DB
	KVStore             kvstore.KVStore
	ExpressionService   *expr.Service
	DataProxy           *datasourceproxy.DataSourceProxyService
	QuotaService        quota.Service
	SecretsService      secrets.Service
	Metrics             *metrics.NGAlert
	NotificationService notifications.Service
	Log                 log.Logger
	renderService       rendering.Service
	imageService        image.ImageService
	schedule            schedule.ScheduleService
	stateManager        *state.Manager
	folderService       folder.Service
	dashboardService    dashboards.DashboardService
	api                 *api.API

	// Alerting notification services
	MultiOrgAlertmanager *notifier.MultiOrgAlertmanager
	AlertsRouter         *sender.AlertsRouter
	accesscontrol        accesscontrol.AccessControl
	accesscontrolService accesscontrol.Service
	annotationsRepo      annotations.Repository
	store                *store.DBstore

	bus          bus.Bus
	pluginsStore plugins.Store
	tracer       tracing.Tracer
}

func (ng *AlertNG) init() error {
	var err error

	// AlertNG should be initialized before the cancellation deadline of initCtx
	initCtx, cancelFunc := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancelFunc()

	store := &store.DBstore{
		Cfg:              ng.Cfg.UnifiedAlerting,
		FeatureToggles:   ng.FeatureToggles,
		SQLStore:         ng.SQLStore,
		Logger:           ng.Log,
		FolderService:    ng.folderService,
		AccessControl:    ng.accesscontrol,
		DashboardService: ng.dashboardService,
	}
	ng.store = store

	decryptFn := ng.SecretsService.GetDecryptedValue
	multiOrgMetrics := ng.Metrics.GetMultiOrgAlertmanagerMetrics()
	ng.MultiOrgAlertmanager, err = notifier.NewMultiOrgAlertmanager(ng.Cfg, store, store, ng.KVStore, store, decryptFn, multiOrgMetrics, ng.NotificationService, log.New("ngalert.multiorg.alertmanager"), ng.SecretsService)
	if err != nil {
		return err
	}

	imageService, err := image.NewScreenshotImageServiceFromCfg(ng.Cfg, store, ng.dashboardService, ng.renderService, ng.Metrics.Registerer)
	if err != nil {
		return err
	}
	ng.imageService = imageService

	// Let's make sure we're able to complete an initial sync of Alertmanagers before we start the alerting components.
	if err := ng.MultiOrgAlertmanager.LoadAndSyncAlertmanagersForOrgs(initCtx); err != nil {
		return fmt.Errorf("failed to initialize alerting because multiorg alertmanager manager failed to warm up: %w", err)
	}

	appUrl, err := url.Parse(ng.Cfg.AppURL)
	if err != nil {
		ng.Log.Error("Failed to parse application URL. Continue without it.", "error", err)
		appUrl = nil
	}

	clk := clock.New()

	alertsRouter := sender.NewAlertsRouter(ng.MultiOrgAlertmanager, store, clk, appUrl, ng.Cfg.UnifiedAlerting.DisabledOrgs,
		ng.Cfg.UnifiedAlerting.AdminConfigPollInterval, ng.DataSourceService, ng.SecretsService)

	// Make sure we sync at least once as Grafana starts to get the router up and running before we start sending any alerts.
	if err := alertsRouter.SyncAndApplyConfigFromDatabase(); err != nil {
		return fmt.Errorf("failed to initialize alerting because alert notifications router failed to warm up: %w", err)
	}

	ng.AlertsRouter = alertsRouter

	evalFactory := eval.NewEvaluatorFactory(ng.Cfg.UnifiedAlerting, ng.DataSourceCache, ng.ExpressionService, ng.pluginsStore)
	schedCfg := schedule.SchedulerCfg{
		MaxAttempts:          ng.Cfg.UnifiedAlerting.MaxAttempts,
		C:                    clk,
		BaseInterval:         ng.Cfg.UnifiedAlerting.BaseInterval,
		MinRuleInterval:      ng.Cfg.UnifiedAlerting.MinInterval,
		DisableGrafanaFolder: ng.Cfg.UnifiedAlerting.ReservedLabels.IsReservedLabelDisabled(models.FolderTitleLabel),
		AppURL:               appUrl,
		EvaluatorFactory:     evalFactory,
		RuleStore:            store,
		Metrics:              ng.Metrics.GetSchedulerMetrics(),
		AlertSender:          alertsRouter,
		Tracer:               ng.tracer,
	}

	// There are a set of feature toggles available that act as short-circuits for common configurations.
	// If any are set, override the config accordingly.
	applyStateHistoryFeatureToggles(&ng.Cfg.UnifiedAlerting.StateHistory, ng.FeatureToggles, ng.Log)
	history, err := configureHistorianBackend(initCtx, ng.Cfg.UnifiedAlerting.StateHistory, ng.annotationsRepo, ng.dashboardService, ng.store, ng.Metrics.GetHistorianMetrics(), ng.Log)
	if err != nil {
		return err
	}
	cfg := state.ManagerCfg{
		Metrics:              ng.Metrics.GetStateMetrics(),
		ExternalURL:          appUrl,
		InstanceStore:        store,
		Images:               ng.imageService,
		Clock:                clk,
		Historian:            history,
		DoNotSaveNormalState: ng.FeatureToggles.IsEnabled(featuremgmt.FlagAlertingNoNormalState),
	}
	stateManager := state.NewManager(cfg)
	scheduler := schedule.NewScheduler(schedCfg, stateManager)

	// if it is required to include folder title to the alerts, we need to subscribe to changes of alert title
	if !ng.Cfg.UnifiedAlerting.ReservedLabels.IsReservedLabelDisabled(models.FolderTitleLabel) {
		subscribeToFolderChanges(ng.Log, ng.bus, store)
	}

	ng.stateManager = stateManager
	ng.schedule = scheduler

	// Provisioning
	policyService := provisioning.NewNotificationPolicyService(store, store, store, ng.Cfg.UnifiedAlerting, ng.Log)
	contactPointService := provisioning.NewContactPointService(store, ng.SecretsService, store, store, ng.Log)
	templateService := provisioning.NewTemplateService(store, store, store, ng.Log)
	muteTimingService := provisioning.NewMuteTimingService(store, store, store, ng.Log)
	alertRuleService := provisioning.NewAlertRuleService(store, store, ng.dashboardService, ng.QuotaService, store,
		int64(ng.Cfg.UnifiedAlerting.DefaultRuleEvaluationInterval.Seconds()),
		int64(ng.Cfg.UnifiedAlerting.BaseInterval.Seconds()), ng.Log)

	ng.api = &api.API{
		Cfg:                  ng.Cfg,
		DatasourceCache:      ng.DataSourceCache,
		DatasourceService:    ng.DataSourceService,
		RouteRegister:        ng.RouteRegister,
		DataProxy:            ng.DataProxy,
		QuotaService:         ng.QuotaService,
		TransactionManager:   store,
		RuleStore:            store,
		AlertingStore:        store,
		AdminConfigStore:     store,
		ProvenanceStore:      store,
		MultiOrgAlertmanager: ng.MultiOrgAlertmanager,
		StateManager:         ng.stateManager,
		AccessControl:        ng.accesscontrol,
		Policies:             policyService,
		ContactPointService:  contactPointService,
		Templates:            templateService,
		MuteTimings:          muteTimingService,
		AlertRules:           alertRuleService,
		AlertsRouter:         alertsRouter,
		EvaluatorFactory:     evalFactory,
		FeatureManager:       ng.FeatureToggles,
		AppUrl:               appUrl,
		Historian:            history,
		Hooks:                api.NewHooks(),
	}
	ng.api.RegisterAPIEndpoints(ng.Metrics.GetAPIMetrics())

	defaultLimits, err := readQuotaConfig(ng.Cfg)
	if err != nil {
		return err
	}

	if err := ng.QuotaService.RegisterQuotaReporter(&quota.NewUsageReporter{
		TargetSrv:     models.QuotaTargetSrv,
		DefaultLimits: defaultLimits,
		Reporter:      ng.api.Usage,
	}); err != nil {
		return err
	}

	log.RegisterContextualLogProvider(func(ctx context.Context) ([]interface{}, bool) {
		key, ok := models.RuleKeyFromContext(ctx)
		if !ok {
			return nil, false
		}
		return key.LogContext(), true
	})

	return DeclareFixedRoles(ng.accesscontrolService)
}

func subscribeToFolderChanges(logger log.Logger, bus bus.Bus, dbStore api.RuleStore) {
	// if folder title is changed, we update all alert rules in that folder to make sure that all peers (in HA mode) will update folder title and
	// clean up the current state
	bus.AddEventListener(func(ctx context.Context, e *events.FolderTitleUpdated) error {
		// do not block the upstream execution
		go func(evt *events.FolderTitleUpdated) {
			logger.Info("Got folder title updated event. updating rules in the folder", "folderUID", evt.UID)
			_, err := dbStore.IncreaseVersionForAllRulesInNamespace(ctx, evt.OrgID, evt.UID)
			if err != nil {
				logger.Error("Failed to update alert rules in the folder after its title was changed", "error", err, "folderUID", evt.UID, "folder", evt.Title)
				return
			}
		}(e)
		return nil
	})
}

// Run starts the scheduler and Alertmanager.
func (ng *AlertNG) Run(ctx context.Context) error {
	ng.Log.Debug("Starting")
	ng.stateManager.Warm(ctx, ng.store)

	children, subCtx := errgroup.WithContext(ctx)

	children.Go(func() error {
		return ng.stateManager.Run(subCtx)
	})

	children.Go(func() error {
		return ng.MultiOrgAlertmanager.Run(subCtx)
	})
	children.Go(func() error {
		return ng.AlertsRouter.Run(subCtx)
	})

	if ng.Cfg.UnifiedAlerting.ExecuteAlerts {
		children.Go(func() error {
			return ng.schedule.Run(subCtx)
		})
	}
	return children.Wait()
}

// IsDisabled returns true if the alerting service is disabled for this instance.
func (ng *AlertNG) IsDisabled() bool {
	if ng.Cfg == nil {
		return true
	}
	return !ng.Cfg.UnifiedAlerting.IsEnabled()
}

// GetHooks returns a facility for replacing handlers for paths. The handler hook for a path
// is invoked after all other middleware is invoked (authentication, instrumentation).
func (ng *AlertNG) GetHooks() *api.Hooks {
	return ng.api.Hooks
}

func readQuotaConfig(cfg *setting.Cfg) (*quota.Map, error) {
	limits := &quota.Map{}

	if cfg == nil {
		return limits, nil
	}

	var alertOrgQuota int64
	var alertGlobalQuota int64

	if cfg.UnifiedAlerting.IsEnabled() {
		alertOrgQuota = cfg.Quota.Org.AlertRule
		alertGlobalQuota = cfg.Quota.Global.AlertRule
	}

	globalQuotaTag, err := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.GlobalScope)
	if err != nil {
		return limits, err
	}
	orgQuotaTag, err := quota.NewTag(models.QuotaTargetSrv, models.QuotaTarget, quota.OrgScope)
	if err != nil {
		return limits, err
	}

	limits.Set(globalQuotaTag, alertGlobalQuota)
	limits.Set(orgQuotaTag, alertOrgQuota)
	return limits, nil
}

type Historian interface {
	api.Historian
	state.Historian
}

func configureHistorianBackend(ctx context.Context, cfg setting.UnifiedAlertingStateHistorySettings, ar annotations.Repository, ds dashboards.DashboardService, rs historian.RuleStore, met *metrics.Historian, l log.Logger) (Historian, error) {
	if !cfg.Enabled {
		met.Info.WithLabelValues("noop").Set(0)
		return historian.NewNopHistorian(), nil
	}

	backend, err := historian.ParseBackendType(cfg.Backend)
	if err != nil {
		return nil, err
	}

	met.Info.WithLabelValues(backend.String()).Set(1)
	if backend == historian.BackendTypeMultiple {
		primaryCfg := cfg
		primaryCfg.Backend = cfg.MultiPrimary
		primary, err := configureHistorianBackend(ctx, primaryCfg, ar, ds, rs, met, l)
		if err != nil {
			return nil, fmt.Errorf("multi-backend target \"%s\" was misconfigured: %w", cfg.MultiPrimary, err)
		}

		var secondaries []historian.Backend
		for _, b := range cfg.MultiSecondaries {
			secCfg := cfg
			secCfg.Backend = b
			sec, err := configureHistorianBackend(ctx, secCfg, ar, ds, rs, met, l)
			if err != nil {
				return nil, fmt.Errorf("multi-backend target \"%s\" was miconfigured: %w", b, err)
			}
			secondaries = append(secondaries, sec)
		}

		l.Info("State history is operating in multi-backend mode", "primary", cfg.MultiPrimary, "secondaries", cfg.MultiSecondaries)
		return historian.NewMultipleBackend(primary, secondaries...), nil
	}
	if backend == historian.BackendTypeAnnotations {
		return historian.NewAnnotationBackend(ar, ds, rs, met), nil
	}
	if backend == historian.BackendTypeLoki {
		lcfg, err := historian.NewLokiConfig(cfg)
		if err != nil {
			return nil, fmt.Errorf("invalid remote loki configuration: %w", err)
		}
		req := historian.NewRequester()
		backend := historian.NewRemoteLokiBackend(lcfg, req, met)

		testConnCtx, cancelFunc := context.WithTimeout(ctx, 10*time.Second)
		defer cancelFunc()
		if err := backend.TestConnection(testConnCtx); err != nil {
			l.Error("Failed to communicate with configured remote Loki backend, state history may not be persisted", "error", err)
		}
		return backend, nil
	}

	return nil, fmt.Errorf("unrecognized state history backend: %s", backend)
}

// applyStateHistoryFeatureToggles edits state history configuration to comply with currently active feature toggles.
func applyStateHistoryFeatureToggles(cfg *setting.UnifiedAlertingStateHistorySettings, ft featuremgmt.FeatureToggles, logger log.Logger) {
	backend, _ := historian.ParseBackendType(cfg.Backend)
	// These feature toggles represent specific, common backend configurations.
	// If all toggles are enabled, we listen to the state history config as written.
	// If any of them are disabled, we ignore the configured backend and treat the toggles as an override.
	// If multiple toggles are disabled, we go with the most "restrictive" one.
	if !ft.IsEnabled(featuremgmt.FlagAlertStateHistoryLokiSecondary) {
		// If we cannot even treat Loki as a secondary, we must use annotations only.
		if backend == historian.BackendTypeMultiple || backend == historian.BackendTypeLoki {
			logger.Info("Forcing Annotation backend due to state history feature toggles")
			cfg.Backend = historian.BackendTypeAnnotations.String()
			cfg.MultiPrimary = ""
			cfg.MultiSecondaries = make([]string, 0)
		}
		return
	}
	if !ft.IsEnabled(featuremgmt.FlagAlertStateHistoryLokiPrimary) {
		// If we're using multiple backends, Loki must be the secondary.
		if backend == historian.BackendTypeMultiple {
			logger.Info("Coercing Loki to a secondary backend due to state history feature toggles")
			cfg.MultiPrimary = historian.BackendTypeAnnotations.String()
			cfg.MultiSecondaries = []string{historian.BackendTypeLoki.String()}
		}
		// If we're using loki, we are only allowed to use it as a secondary. Dual write to it, plus annotations.
		if backend == historian.BackendTypeLoki {
			logger.Info("Coercing Loki to dual writes with a secondary backend due to state history feature toggles")
			cfg.Backend = historian.BackendTypeMultiple.String()
			cfg.MultiPrimary = historian.BackendTypeAnnotations.String()
			cfg.MultiSecondaries = []string{historian.BackendTypeLoki.String()}
		}
		return
	}
	if !ft.IsEnabled(featuremgmt.FlagAlertStateHistoryLokiOnly) {
		// If we're not allowed to use Loki only, make it the primary but keep the annotation writes.
		if backend == historian.BackendTypeLoki {
			logger.Info("Forcing dual writes to Loki and Annotations due to state history feature toggles")
			cfg.Backend = historian.BackendTypeMultiple.String()
			cfg.MultiPrimary = historian.BackendTypeLoki.String()
			cfg.MultiSecondaries = []string{historian.BackendTypeAnnotations.String()}
		}
		return
	}
}
