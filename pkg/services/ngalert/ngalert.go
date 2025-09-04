package ngalert

import (
	"context"
	"fmt"
	"time"

	"github.com/benbjohnson/clock"
	"github.com/prometheus/alertmanager/featurecontrol"
	"github.com/prometheus/alertmanager/matchers/compat"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/guardian"
	"github.com/grafana/grafana/pkg/services/ngalert/api"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/image"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/migration"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/remote"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
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
	pluginsStore pluginstore.Store,
	tracer tracing.Tracer,
	ruleStore *store.DBstore,
	upgradeService migration.UpgradeService,

	// This is necessary to ensure the guardian provider is initialized before we run the migration.
	_ *guardian.Provider,
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
		store:                ruleStore,
		upgradeService:       upgradeService,
	}

	// Migration is called even if UA is disabled. If UA is disabled, this will do nothing except handle logic around
	// reverting the migration.
	err := ng.upgradeService.Run(context.Background())
	if err != nil {
		return nil, err
	}

	if !ng.shouldRun() {
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
	ImageService        image.ImageService
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
	pluginsStore pluginstore.Store
	tracer       tracing.Tracer

	upgradeService migration.UpgradeService
}

func (ng *AlertNG) init() error {
	// AlertNG should be initialized before the cancellation deadline of initCtx
	initCtx, cancelFunc := context.WithTimeout(context.Background(), ng.Cfg.UnifiedAlerting.InitializationTimeout) // LOGZ.IO GRAFANA CHANGE :: DEV-48976 - Make context deadline on AlertNG service startup configurable - cherrypick from: 1fdc48fabafe8b8480a58fb4a169d01ebb535fb2
	defer cancelFunc()

	ng.store.Logger = ng.Log

	// This initializes the compat package in fallback mode with logging. It parses first
	// using the UTF-8 parser and then fallsback to the classic parser on error.
	// UTF-8 is permitted in label names. This should be removed when the compat package
	// is removed from Alertmanager.
	compat.InitFromFlags(ng.Log, featurecontrol.NoopFlags{})

	// If enabled, configure the remote Alertmanager.
	// - If several toggles are enabled, the order of precedence is RemoteOnly, RemotePrimary, RemoteSecondary
	// - If no toggles are enabled, we default to using only the internal Alertmanager
	// We currently support only remote secondary mode, so in case other toggles are enabled we fall back to remote secondary.
	var overrides []notifier.Option
	moaLogger := log.New("ngalert.multiorg.alertmanager")
	remoteOnly := ng.FeatureToggles.IsEnabled(initCtx, featuremgmt.FlagAlertmanagerRemoteOnly)
	remotePrimary := ng.FeatureToggles.IsEnabled(initCtx, featuremgmt.FlagAlertmanagerRemotePrimary)
	remoteSecondary := ng.FeatureToggles.IsEnabled(initCtx, featuremgmt.FlagAlertmanagerRemoteSecondary)
	if ng.Cfg.UnifiedAlerting.RemoteAlertmanager.Enable {
		switch {
		case remoteOnly, remotePrimary:
			ng.Log.Warn("Only remote secondary mode is supported at the moment, falling back to remote secondary")
			fallthrough

		case remoteSecondary:
			ng.Log.Debug("Starting Grafana with remote secondary mode enabled")
			m := ng.Metrics.GetRemoteAlertmanagerMetrics()
			m.Info.WithLabelValues(metrics.ModeRemoteSecondary).Set(1)

			// This function will be used by the MOA to create new Alertmanagers.
			override := notifier.WithAlertmanagerOverride(func(factoryFn notifier.OrgAlertmanagerFactory) notifier.OrgAlertmanagerFactory {
				return func(ctx context.Context, orgID int64) (notifier.Alertmanager, error) {
					// Create internal Alertmanager.
					internalAM, err := factoryFn(ctx, orgID)
					if err != nil {
						return nil, err
					}

					// Create remote Alertmanager.
					remoteAM, err := createRemoteAlertmanager(orgID, ng.Cfg.UnifiedAlerting.RemoteAlertmanager, ng.KVStore, m)
					if err != nil {
						moaLogger.Error("Failed to create remote Alertmanager, falling back to using only the internal one", "err", err)
						return internalAM, nil
					}

					// Use both Alertmanager implementations in the forked Alertmanager.
					cfg := remote.RemoteSecondaryConfig{
						Logger:       log.New("ngalert.forked-alertmanager.remote-secondary"),
						OrgID:        orgID,
						Store:        ng.store,
						SyncInterval: ng.Cfg.UnifiedAlerting.RemoteAlertmanager.SyncInterval,
					}
					return remote.NewRemoteSecondaryForkedAlertmanager(cfg, internalAM, remoteAM)
				}
			})

			overrides = append(overrides, override)

		default:
			ng.Log.Error("A mode should be selected when enabling the remote Alertmanager, falling back to using only the internal Alertmanager")
		}
	}

	decryptFn := ng.SecretsService.GetDecryptedValue
	multiOrgMetrics := ng.Metrics.GetMultiOrgAlertmanagerMetrics()
	moa, err := notifier.NewMultiOrgAlertmanager(ng.Cfg, ng.store, ng.store, ng.KVStore, ng.store, decryptFn, multiOrgMetrics, ng.NotificationService, moaLogger, ng.SecretsService, ng.FeatureToggles, overrides...)
	if err != nil {
		return err
	}
	ng.MultiOrgAlertmanager = moa

	imageService, err := image.NewScreenshotImageServiceFromCfg(ng.Cfg, ng.store, ng.dashboardService, ng.renderService, ng.Metrics.Registerer)
	if err != nil {
		return err
	}
	ng.ImageService = imageService

	// Let's make sure we're able to complete an initial sync of Alertmanagers before we start the alerting components.
	if err := ng.MultiOrgAlertmanager.LoadAndSyncAlertmanagersForOrgs(initCtx); err != nil {
		return fmt.Errorf("failed to initialize alerting because multiorg alertmanager manager failed to warm up: %w", err)
	}

	// LOGZ.IO GRAFANA CHANGE :: DEV-43657 - Set APP url to logzio grafana for alert notification URLs
	//appUrl, err := url.Parse(ng.Cfg.AppURL)
	//if err != nil {
	//	ng.Log.Error("Failed to parse application URL. Continue without it.", "error", err)
	//	appUrl = nil
	//}
	appUrl := ng.Cfg.ParsedAppURL
	// LOGZ.IO GRAFANA CHANGE :: End

	clk := clock.New()

	alertsRouter := sender.NewAlertsRouter(ng.MultiOrgAlertmanager, ng.store, clk, appUrl, ng.Cfg.UnifiedAlerting.DisabledOrgs,
		ng.Cfg.UnifiedAlerting.AdminConfigPollInterval, ng.DataSourceService, ng.SecretsService)

	// Make sure we sync at least once as Grafana starts to get the router up and running before we start sending any alerts.
	if err := alertsRouter.SyncAndApplyConfigFromDatabase(); err != nil {
		return fmt.Errorf("failed to initialize alerting because alert notifications router failed to warm up: %w", err)
	}

	ng.AlertsRouter = alertsRouter

	// LOGZ.IO GRAFANA CHANGE :: DEV-43744 Add logzio notification route
	var alertsSender schedule.AlertsSender
	ng.Log.Debug("Unified Alerting scheduled evaluation config", "scheduled_evaluation_enabled", ng.Cfg.UnifiedAlerting.ScheduledEvalEnabled)
	if ng.Cfg.UnifiedAlerting.ScheduledEvalEnabled {
		alertsSender = alertsRouter
	} else {
		alertsSender, err = sender.NewLogzioAlertsRouter(ng.Cfg.UnifiedAlerting.LogzioAlertsRouterUrl)
		if err != nil {
			return err
		}
	}
	// LOGZ.IO GRAFANA CHANGE :: End

	evalFactory := eval.NewEvaluatorFactory(ng.Cfg.UnifiedAlerting, ng.DataSourceCache, ng.ExpressionService, ng.pluginsStore)
	schedCfg := schedule.SchedulerCfg{
		MaxAttempts:          ng.Cfg.UnifiedAlerting.MaxAttempts,
		C:                    clk,
		BaseInterval:         ng.Cfg.UnifiedAlerting.BaseInterval,
		MinRuleInterval:      ng.Cfg.UnifiedAlerting.MinInterval,
		DisableGrafanaFolder: ng.Cfg.UnifiedAlerting.ReservedLabels.IsReservedLabelDisabled(models.FolderTitleLabel),
		JitterEvaluations:    schedule.JitterStrategyFrom(ng.Cfg.UnifiedAlerting, ng.FeatureToggles),
		AppURL:               appUrl,
		EvaluatorFactory:     evalFactory,
		RuleStore:            ng.store,
		Metrics:              ng.Metrics.GetSchedulerMetrics(),
		AlertSender:          alertsSender, // LOGZ.IO GRAFANA CHANGE :: DEV-43744 Add logzio notification route
		Tracer:               ng.tracer,
		Log:                  log.New("ngalert.scheduler"),
		ScheduledEvalEnabled: ng.Cfg.UnifiedAlerting.ScheduledEvalEnabled, // LOGZ.IO GRAFANA CHANGE :: DEV-43744 Add scheduled evaluation enabled config
	}

	// There are a set of feature toggles available that act as short-circuits for common configurations.
	// If any are set, override the config accordingly.
	ApplyStateHistoryFeatureToggles(&ng.Cfg.UnifiedAlerting.StateHistory, ng.FeatureToggles, ng.Log)
	history, err := configureHistorianBackend(initCtx, ng.Cfg.UnifiedAlerting.StateHistory, ng.annotationsRepo, ng.dashboardService, ng.store, ng.Metrics.GetHistorianMetrics(), ng.Log)
	if err != nil {
		return err
	}
	cfg := state.ManagerCfg{
		Metrics:                        ng.Metrics.GetStateMetrics(),
		ExternalURL:                    appUrl,
		InstanceStore:                  ng.store,
		Images:                         ng.ImageService,
		Clock:                          clk,
		Historian:                      history,
		DoNotSaveNormalState:           ng.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingNoNormalState),
		ApplyNoDataAndErrorToAllStates: ng.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingNoDataErrorExecution),
		MaxStateSaveConcurrency:        ng.Cfg.UnifiedAlerting.MaxStateSaveConcurrency,
		RulesPerRuleGroupLimit:         ng.Cfg.UnifiedAlerting.RulesPerRuleGroupLimit,
		Tracer:                         ng.tracer,
		Log:                            log.New("ngalert.state.manager"),
	}
	logger := log.New("ngalert.state.manager.persist")
	statePersister := state.NewSyncStatePersisiter(logger, cfg)
	if ng.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingSaveStatePeriodic) {
		ticker := clock.New().Ticker(ng.Cfg.UnifiedAlerting.StatePeriodicSaveInterval)
		statePersister = state.NewAsyncStatePersister(logger, ticker, cfg)
	}
	stateManager := state.NewManager(cfg, statePersister)
	scheduler := schedule.NewScheduler(schedCfg, stateManager, ng.store) // LOGZ.IO GRAFANA CHANGE :: DEV-47243 Handle state cache inconsistency on eval - warm cache in scheduler as temporary solution

	// if it is required to include folder title to the alerts, we need to subscribe to changes of alert title
	if !ng.Cfg.UnifiedAlerting.ReservedLabels.IsReservedLabelDisabled(models.FolderTitleLabel) {
		subscribeToFolderChanges(ng.Log, ng.bus, ng.store)
	}

	ng.stateManager = stateManager
	ng.schedule = scheduler

	receiverService := notifier.NewReceiverService(ng.accesscontrol, ng.store, ng.store, ng.SecretsService, ng.store, ng.Log)

	// Provisioning
	policyService := provisioning.NewNotificationPolicyService(ng.store, ng.store, ng.store, ng.Cfg.UnifiedAlerting, ng.Log)
	contactPointService := provisioning.NewContactPointService(ng.store, ng.SecretsService, ng.store, ng.store, receiverService, ng.Log, ng.store)
	templateService := provisioning.NewTemplateService(ng.store, ng.store, ng.store, ng.Log)
	muteTimingService := provisioning.NewMuteTimingService(ng.store, ng.store, ng.store, ng.Log)
	alertRuleService := provisioning.NewAlertRuleService(ng.store, ng.store, ng.dashboardService, ng.QuotaService, ng.store,
		int64(ng.Cfg.UnifiedAlerting.DefaultRuleEvaluationInterval.Seconds()),
		int64(ng.Cfg.UnifiedAlerting.BaseInterval.Seconds()),
		ng.Cfg.UnifiedAlerting.RulesPerRuleGroupLimit, ng.Log, notifier.NewNotificationSettingsValidationService(ng.store))

	ng.api = &api.API{
		Cfg:                  ng.Cfg,
		DatasourceCache:      ng.DataSourceCache,
		DatasourceService:    ng.DataSourceService,
		RouteRegister:        ng.RouteRegister,
		DataProxy:            ng.DataProxy,
		QuotaService:         ng.QuotaService,
		TransactionManager:   ng.store,
		RuleStore:            ng.store,
		AlertingStore:        ng.store,
		AdminConfigStore:     ng.store,
		ProvenanceStore:      ng.store,
		MultiOrgAlertmanager: ng.MultiOrgAlertmanager,
		StateManager:         ng.stateManager,
		AccessControl:        ng.accesscontrol,
		Policies:             policyService,
		ReceiverService:      receiverService,
		ContactPointService:  contactPointService,
		Templates:            templateService,
		MuteTimings:          muteTimingService,
		AlertRules:           alertRuleService,
		AlertsRouter:         alertsRouter,
		EvaluatorFactory:     evalFactory,
		FeatureManager:       ng.FeatureToggles,
		AppUrl:               appUrl,
		Historian:            history,
		Hooks:                api.NewHooks(ng.Log),
		Tracer:               ng.tracer,
		UpgradeService:       ng.upgradeService,
		Schedule:             ng.schedule, // LOGZ.IO GRAFANA CHANGE :: DEV-43744 Add alert evaluation API
	}
	ng.api.RegisterAPIEndpoints(ng.Metrics.GetAPIMetrics())

	if err := RegisterQuotas(ng.Cfg, ng.QuotaService, ng.store); err != nil {
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
	bus.AddEventListener(func(ctx context.Context, evt *events.FolderTitleUpdated) error {
		logger.Info("Got folder title updated event. updating rules in the folder", "folderUID", evt.UID)
		_, err := dbStore.IncreaseVersionForAllRulesInNamespace(ctx, evt.OrgID, evt.UID)
		if err != nil {
			logger.Error("Failed to update alert rules in the folder after its title was changed", "error", err, "folderUID", evt.UID, "folder", evt.Title)
			return err
		}
		return nil
	})
}

// shouldRun determines if AlertNG should init or run anything more than just the migration.
func (ng *AlertNG) shouldRun() bool {
	if ng.Cfg.UnifiedAlerting.IsEnabled() {
		return true
	}

	// Feature flag will preview UA alongside legacy, so that UA routes are registered but the scheduler remains disabled.
	if ng.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingPreviewUpgrade) {
		return true
	}

	return false
}

// Run starts the scheduler and Alertmanager.
func (ng *AlertNG) Run(ctx context.Context) error {
	if !ng.shouldRun() {
		return nil
	}
	ng.Log.Debug("Starting", "execute_alerts", ng.Cfg.UnifiedAlerting.ExecuteAlerts)

	children, subCtx := errgroup.WithContext(ctx)

	children.Go(func() error {
		return ng.MultiOrgAlertmanager.Run(subCtx)
	})
	children.Go(func() error {
		return ng.AlertsRouter.Run(subCtx)
	})

	// We explicitly check that UA is enabled here in case FlagAlertingPreviewUpgrade is enabled but UA is disabled.
	if ng.Cfg.UnifiedAlerting.ExecuteAlerts && ng.Cfg.UnifiedAlerting.IsEnabled() {
		// Only Warm() the state manager if we are actually executing alerts.
		// Doing so when we are not executing alerts is wasteful and could lead
		// to misleading rule status queries, as the status returned will be
		// always based on the state loaded from the database at startup, and
		// not the most recent evaluation state.
		//
		// Also note that this runs synchronously to ensure state is loaded
		// before rule evaluation begins, hence we use ctx and not subCtx.
		//
		ng.stateManager.Warm(ctx, ng.store)

		children.Go(func() error {
			return ng.schedule.Run(subCtx)
		})
		children.Go(func() error {
			return ng.stateManager.Run(subCtx)
		})
	}
	return children.Wait()
}

// IsDisabled returns true if the alerting service is disabled for this instance.
func (ng *AlertNG) IsDisabled() bool {
	return ng.Cfg == nil
}

// GetHooks returns a facility for replacing handlers for paths. The handler hook for a path
// is invoked after all other middleware is invoked (authentication, instrumentation).
func (ng *AlertNG) GetHooks() *api.Hooks {
	return ng.api.Hooks
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
		store := historian.NewAnnotationStore(ar, ds, met)
		return historian.NewAnnotationBackend(store, rs, met), nil
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

// ApplyStateHistoryFeatureToggles edits state history configuration to comply with currently active feature toggles.
func ApplyStateHistoryFeatureToggles(cfg *setting.UnifiedAlertingStateHistorySettings, ft featuremgmt.FeatureToggles, logger log.Logger) {
	backend, _ := historian.ParseBackendType(cfg.Backend)
	// These feature toggles represent specific, common backend configurations.
	// If all toggles are enabled, we listen to the state history config as written.
	// If any of them are disabled, we ignore the configured backend and treat the toggles as an override.
	// If multiple toggles are disabled, we go with the most "restrictive" one.
	if !ft.IsEnabledGlobally(featuremgmt.FlagAlertStateHistoryLokiSecondary) {
		// If we cannot even treat Loki as a secondary, we must use annotations only.
		if backend == historian.BackendTypeMultiple || backend == historian.BackendTypeLoki {
			logger.Info("Forcing Annotation backend due to state history feature toggles")
			cfg.Backend = historian.BackendTypeAnnotations.String()
			cfg.MultiPrimary = ""
			cfg.MultiSecondaries = make([]string, 0)
		}
		return
	}
	if !ft.IsEnabledGlobally(featuremgmt.FlagAlertStateHistoryLokiPrimary) {
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
	if !ft.IsEnabledGlobally(featuremgmt.FlagAlertStateHistoryLokiOnly) {
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

func createRemoteAlertmanager(orgID int64, amCfg setting.RemoteAlertmanagerSettings, kvstore kvstore.KVStore, m *metrics.RemoteAlertmanager) (*remote.Alertmanager, error) {
	externalAMCfg := remote.AlertmanagerConfig{
		OrgID:             orgID,
		URL:               amCfg.URL,
		TenantID:          amCfg.TenantID,
		BasicAuthPassword: amCfg.Password,
	}
	// We won't be handling files on disk, we can pass an empty string as workingDirPath.
	stateStore := notifier.NewFileStore(orgID, kvstore, "")
	return remote.NewAlertmanager(externalAMCfg, stateStore, m)
}
