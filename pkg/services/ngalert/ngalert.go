package ngalert

import (
	"context"
	"fmt"
	"net/url"
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
	"github.com/grafana/grafana/pkg/infra/httpclient"
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
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/api"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/image"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/remote"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/writer"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/user"
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
	httpClientProvider httpclient.Provider,
	resourcePermissions accesscontrol.ReceiverPermissionsService,
	userService user.Service,
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
		AccesscontrolService: accesscontrolService,
		annotationsRepo:      annotationsRepo,
		pluginsStore:         pluginsStore,
		tracer:               tracer,
		store:                ruleStore,
		httpClientProvider:   httpClientProvider,
		ResourcePermissions:  resourcePermissions,
		userService:          userService,
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
	ImageService        image.ImageService
	RecordingWriter     schedule.RecordingWriter
	schedule            schedule.ScheduleService
	stateManager        *state.Manager
	folderService       folder.Service
	dashboardService    dashboards.DashboardService
	Api                 *api.API
	httpClientProvider  httpclient.Provider
	InstanceStore       state.InstanceStore
	// StartupInstanceReader is used to fetch the state of alerts on startup.
	StartupInstanceReader state.InstanceReader

	// Alerting notification services
	MultiOrgAlertmanager *notifier.MultiOrgAlertmanager
	AlertsRouter         *sender.AlertsRouter
	accesscontrol        accesscontrol.AccessControl
	AccesscontrolService accesscontrol.Service
	ResourcePermissions  accesscontrol.ReceiverPermissionsService
	annotationsRepo      annotations.Repository
	store                *store.DBstore
	userService          user.Service

	bus          bus.Bus
	pluginsStore pluginstore.Store
	tracer       tracing.Tracer
}

func (ng *AlertNG) init() error {
	// AlertNG should be initialized before the cancellation deadline of initCtx
	initCtx, cancelFunc := context.WithTimeout(context.Background(), ng.Cfg.UnifiedAlerting.InitializationTimeout)
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
	// We currently do not support remote primary mode, so we fall back to remote secondary.
	var overrides []notifier.Option
	moaLogger := log.New("ngalert.multiorg.alertmanager")
	remoteOnly := ng.FeatureToggles.IsEnabled(initCtx, featuremgmt.FlagAlertmanagerRemoteOnly)
	remotePrimary := ng.FeatureToggles.IsEnabled(initCtx, featuremgmt.FlagAlertmanagerRemotePrimary)
	remoteSecondary := ng.FeatureToggles.IsEnabled(initCtx, featuremgmt.FlagAlertmanagerRemoteSecondary)
	if ng.Cfg.UnifiedAlerting.RemoteAlertmanager.Enable {
		autogenFn := remote.NoopAutogenFn
		if ng.FeatureToggles.IsEnabled(initCtx, featuremgmt.FlagAlertingSimplifiedRouting) {
			autogenFn = func(ctx context.Context, logger log.Logger, orgID int64, cfg *definitions.PostableApiAlertingConfig, skipInvalid bool) error {
				return notifier.AddAutogenConfig(ctx, logger, ng.store, orgID, cfg, skipInvalid)
			}
		}

		switch {
		case remoteOnly:
			ng.Log.Debug("Starting Grafana with remote only mode enabled")
			m := ng.Metrics.GetRemoteAlertmanagerMetrics()
			m.Info.WithLabelValues(metrics.ModeRemoteOnly).Set(1)
			ng.Cfg.UnifiedAlerting.SkipClustering = true

			// This function will be used by the MOA to create new Alertmanagers.
			override := notifier.WithAlertmanagerOverride(func(_ notifier.OrgAlertmanagerFactory) notifier.OrgAlertmanagerFactory {
				return func(ctx context.Context, orgID int64) (notifier.Alertmanager, error) {
					// Create remote Alertmanager.
					cfg := remote.AlertmanagerConfig{
						BasicAuthPassword: ng.Cfg.UnifiedAlerting.RemoteAlertmanager.Password,
						DefaultConfig:     ng.Cfg.UnifiedAlerting.DefaultConfiguration,
						OrgID:             orgID,
						TenantID:          ng.Cfg.UnifiedAlerting.RemoteAlertmanager.TenantID,
						URL:               ng.Cfg.UnifiedAlerting.RemoteAlertmanager.URL,
						PromoteConfig:     true,
						SyncInterval:      ng.Cfg.UnifiedAlerting.RemoteAlertmanager.SyncInterval,
						ExternalURL:       ng.Cfg.AppURL,
						StaticHeaders:     ng.Cfg.Smtp.StaticHeaders,
					}
					remoteAM, err := createRemoteAlertmanager(cfg, ng.KVStore, ng.SecretsService.Decrypt, autogenFn, m, ng.tracer)
					if err != nil {
						moaLogger.Error("Failed to create remote Alertmanager", "err", err)
						return nil, err
					}
					return remoteAM, nil
				}
			})

			overrides = append(overrides, override)

		case remotePrimary:
			ng.Log.Debug("Starting Grafana with remote primary mode enabled")
			m := ng.Metrics.GetRemoteAlertmanagerMetrics()
			m.Info.WithLabelValues(metrics.ModeRemotePrimary).Set(1)
			ng.Cfg.UnifiedAlerting.SkipClustering = true
			// This function will be used by the MOA to create new Alertmanagers.
			override := notifier.WithAlertmanagerOverride(func(factoryFn notifier.OrgAlertmanagerFactory) notifier.OrgAlertmanagerFactory {
				return func(ctx context.Context, orgID int64) (notifier.Alertmanager, error) {
					// Create internal Alertmanager.
					internalAM, err := factoryFn(ctx, orgID)
					if err != nil {
						return nil, err
					}

					// Create remote Alertmanager.
					cfg := remote.AlertmanagerConfig{
						BasicAuthPassword: ng.Cfg.UnifiedAlerting.RemoteAlertmanager.Password,
						DefaultConfig:     ng.Cfg.UnifiedAlerting.DefaultConfiguration,
						OrgID:             orgID,
						PromoteConfig:     true,
						TenantID:          ng.Cfg.UnifiedAlerting.RemoteAlertmanager.TenantID,
						URL:               ng.Cfg.UnifiedAlerting.RemoteAlertmanager.URL,
						ExternalURL:       ng.Cfg.AppURL,
						StaticHeaders:     ng.Cfg.Smtp.StaticHeaders,
					}
					remoteAM, err := createRemoteAlertmanager(cfg, ng.KVStore, ng.SecretsService.Decrypt, autogenFn, m, ng.tracer)
					if err != nil {
						moaLogger.Error("Failed to create remote Alertmanager, falling back to using only the internal one", "err", err)
						return internalAM, nil
					}

					// Use both Alertmanager implementations in the forked Alertmanager.
					return remote.NewRemotePrimaryForkedAlertmanager(log.New("ngalert.forked-alertmanager.remote-primary"), internalAM, remoteAM), nil
				}
			})

			overrides = append(overrides, override)

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
					cfg := remote.AlertmanagerConfig{
						BasicAuthPassword: ng.Cfg.UnifiedAlerting.RemoteAlertmanager.Password,
						DefaultConfig:     ng.Cfg.UnifiedAlerting.DefaultConfiguration,
						OrgID:             orgID,
						TenantID:          ng.Cfg.UnifiedAlerting.RemoteAlertmanager.TenantID,
						URL:               ng.Cfg.UnifiedAlerting.RemoteAlertmanager.URL,
						SyncInterval:      ng.Cfg.UnifiedAlerting.RemoteAlertmanager.SyncInterval,
						ExternalURL:       ng.Cfg.AppURL,
						StaticHeaders:     ng.Cfg.Smtp.StaticHeaders,
					}
					remoteAM, err := createRemoteAlertmanager(cfg, ng.KVStore, ng.SecretsService.Decrypt, autogenFn, m, ng.tracer)
					if err != nil {
						moaLogger.Error("Failed to create remote Alertmanager, falling back to using only the internal one", "err", err)
						return internalAM, nil
					}

					// Use both Alertmanager implementations in the forked Alertmanager.
					rsCfg := remote.RemoteSecondaryConfig{
						Logger:       log.New("ngalert.forked-alertmanager.remote-secondary"),
						OrgID:        orgID,
						Store:        ng.store,
						SyncInterval: ng.Cfg.UnifiedAlerting.RemoteAlertmanager.SyncInterval,
					}
					return remote.NewRemoteSecondaryForkedAlertmanager(rsCfg, internalAM, remoteAM)
				}
			})

			overrides = append(overrides, override)

		default:
			ng.Log.Error("A mode should be selected when enabling the remote Alertmanager, falling back to using only the internal Alertmanager")
		}
	}

	decryptFn := ng.SecretsService.GetDecryptedValue
	multiOrgMetrics := ng.Metrics.GetMultiOrgAlertmanagerMetrics()
	moa, err := notifier.NewMultiOrgAlertmanager(
		ng.Cfg,
		ng.store,
		ng.store,
		ng.KVStore,
		ng.store,
		decryptFn,
		multiOrgMetrics,
		ng.NotificationService,
		ng.ResourcePermissions,
		moaLogger,
		ng.SecretsService,
		ng.FeatureToggles,
		overrides...,
	)
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

	appUrl, err := url.Parse(ng.Cfg.AppURL)
	if err != nil {
		ng.Log.Error("Failed to parse application URL. Continue without it.", "error", err)
		appUrl = nil
	}

	clk := clock.New()

	alertsRouter := sender.NewAlertsRouter(ng.MultiOrgAlertmanager, ng.store, clk, appUrl, ng.Cfg.UnifiedAlerting.DisabledOrgs,
		ng.Cfg.UnifiedAlerting.AdminConfigPollInterval, ng.DataSourceService, ng.SecretsService, ng.FeatureToggles)

	// Make sure we sync at least once as Grafana starts to get the router up and running before we start sending any alerts.
	if err := alertsRouter.SyncAndApplyConfigFromDatabase(initCtx); err != nil {
		return fmt.Errorf("failed to initialize alerting because alert notifications router failed to warm up: %w", err)
	}

	ng.AlertsRouter = alertsRouter

	evalFactory := eval.NewEvaluatorFactory(ng.Cfg.UnifiedAlerting, ng.DataSourceCache, ng.ExpressionService)
	conditionValidator := eval.NewConditionValidator(ng.DataSourceCache, ng.ExpressionService, ng.pluginsStore)

	if !ng.FeatureToggles.IsEnabled(initCtx, featuremgmt.FlagGrafanaManagedRecordingRules) {
		// Force-disable the feature if the feature toggle is not on - sets us up for feature toggle removal.
		ng.Cfg.UnifiedAlerting.RecordingRules.Enabled = false
	}
	recordingWriter, err := createRecordingWriter(ng.FeatureToggles, ng.Cfg.UnifiedAlerting.RecordingRules, ng.httpClientProvider, clk, ng.Metrics.GetRemoteWriterMetrics())
	if err != nil {
		return fmt.Errorf("failed to initialize recording writer: %w", err)
	}
	ng.RecordingWriter = recordingWriter

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
		RecordingRulesCfg:    ng.Cfg.UnifiedAlerting.RecordingRules,
		Metrics:              ng.Metrics.GetSchedulerMetrics(),
		AlertSender:          alertsRouter,
		Tracer:               ng.tracer,
		Log:                  log.New("ngalert.scheduler"),
		RecordingWriter:      ng.RecordingWriter,
	}

	// There are a set of feature toggles available that act as short-circuits for common configurations.
	// If any are set, override the config accordingly.
	ApplyStateHistoryFeatureToggles(&ng.Cfg.UnifiedAlerting.StateHistory, ng.FeatureToggles, ng.Log)
	history, err := configureHistorianBackend(initCtx, ng.Cfg.UnifiedAlerting.StateHistory, ng.annotationsRepo, ng.dashboardService, ng.store, ng.Metrics.GetHistorianMetrics(), ng.Log, ng.tracer, ac.NewRuleService(ng.accesscontrol))
	if err != nil {
		return err
	}

	ng.InstanceStore, ng.StartupInstanceReader = initInstanceStore(ng.store.SQLStore, ng.Log, ng.FeatureToggles)

	stateManagerCfg := state.ManagerCfg{
		Metrics:                        ng.Metrics.GetStateMetrics(),
		ExternalURL:                    appUrl,
		DisableExecution:               !ng.Cfg.UnifiedAlerting.ExecuteAlerts,
		InstanceStore:                  ng.InstanceStore,
		Images:                         ng.ImageService,
		Clock:                          clk,
		Historian:                      history,
		ApplyNoDataAndErrorToAllStates: ng.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingNoDataErrorExecution),
		MaxStateSaveConcurrency:        ng.Cfg.UnifiedAlerting.MaxStateSaveConcurrency,
		StatePeriodicSaveBatchSize:     ng.Cfg.UnifiedAlerting.StatePeriodicSaveBatchSize,
		RulesPerRuleGroupLimit:         ng.Cfg.UnifiedAlerting.RulesPerRuleGroupLimit,
		Tracer:                         ng.tracer,
		Log:                            log.New("ngalert.state.manager"),
		ResolvedRetention:              ng.Cfg.UnifiedAlerting.ResolvedAlertRetention,
	}
	statePersister := initStatePersister(ng.Cfg.UnifiedAlerting, stateManagerCfg, ng.FeatureToggles)
	stateManager := state.NewManager(stateManagerCfg, statePersister)
	scheduler := schedule.NewScheduler(schedCfg, stateManager)

	// if it is required to include folder title to the alerts, we need to subscribe to changes of alert title
	if !ng.Cfg.UnifiedAlerting.ReservedLabels.IsReservedLabelDisabled(models.FolderTitleLabel) {
		subscribeToFolderChanges(ng.Log, ng.bus, ng.store)
	}

	ng.stateManager = stateManager
	ng.schedule = scheduler

	configStore := legacy_storage.NewAlertmanagerConfigStore(ng.store)
	receiverService := notifier.NewReceiverService(
		ac.NewReceiverAccess[*models.Receiver](ng.accesscontrol, false),
		configStore,
		ng.store,
		ng.store,
		ng.SecretsService,
		ng.store,
		ng.Log,
		ng.ResourcePermissions,
		ng.tracer,
	)
	provisioningReceiverService := notifier.NewReceiverService(
		ac.NewReceiverAccess[*models.Receiver](ng.accesscontrol, true),
		configStore,
		ng.store,
		ng.store,
		ng.SecretsService,
		ng.store,
		ng.Log,
		ng.ResourcePermissions,
		ng.tracer,
	)

	// Provisioning
	policyService := provisioning.NewNotificationPolicyService(configStore, ng.store, ng.store, ng.Cfg.UnifiedAlerting, ng.Log)
	contactPointService := provisioning.NewContactPointService(configStore, ng.SecretsService, ng.store, ng.store, provisioningReceiverService, ng.Log, ng.store, ng.ResourcePermissions)
	templateService := provisioning.NewTemplateService(configStore, ng.store, ng.store, ng.Log)
	muteTimingService := provisioning.NewMuteTimingService(configStore, ng.store, ng.store, ng.Log, ng.store)
	alertRuleService := provisioning.NewAlertRuleService(ng.store, ng.store, ng.folderService, ng.QuotaService, ng.store,
		int64(ng.Cfg.UnifiedAlerting.DefaultRuleEvaluationInterval.Seconds()),
		int64(ng.Cfg.UnifiedAlerting.BaseInterval.Seconds()),
		ng.Cfg.UnifiedAlerting.RulesPerRuleGroupLimit, ng.Log, notifier.NewNotificationSettingsValidationService(ng.store),
		ac.NewRuleService(ng.accesscontrol))

	ng.Api = &api.API{
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
		Scheduler:            scheduler,
		AccessControl:        ng.accesscontrol,
		Policies:             policyService,
		ReceiverService:      receiverService,
		ContactPointService:  contactPointService,
		Templates:            templateService,
		MuteTimings:          muteTimingService,
		AlertRules:           alertRuleService,
		AlertsRouter:         alertsRouter,
		EvaluatorFactory:     evalFactory,
		ConditionValidator:   conditionValidator,
		FeatureManager:       ng.FeatureToggles,
		AppUrl:               appUrl,
		Historian:            history,
		Hooks:                api.NewHooks(ng.Log),
		Tracer:               ng.tracer,
		UserService:          ng.userService,
	}
	ng.Api.RegisterAPIEndpoints(ng.Metrics.GetAPIMetrics())

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

	return DeclareFixedRoles(ng.AccesscontrolService, ng.FeatureToggles)
}

// initInstanceStore initializes the instance store based on the feature toggles.
// It returns two vales: the instance store that should be used for writing alert instances,
// and an alert instance reader that can be used to read alert instances on startup.
func initInstanceStore(sqlStore db.DB, logger log.Logger, featureToggles featuremgmt.FeatureToggles) (state.InstanceStore, state.InstanceReader) {
	var instanceStore state.InstanceStore

	// We init both stores here, but only one will be used based on the feature toggles.
	// Two stores are needed for the multi-instance reader to work correctly.
	// It's used to read the state of alerts on startup, and allows switching the feature
	// flags seamlessly without losing the state of alerts.
	protoInstanceStore := store.ProtoInstanceDBStore{
		SQLStore:       sqlStore,
		Logger:         logger,
		FeatureToggles: featureToggles,
	}
	simpleInstanceStore := store.InstanceDBStore{
		SQLStore: sqlStore,
		Logger:   logger,
	}

	if featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingSaveStateCompressed) {
		logger.Info("Using protobuf-based alert instance store")
		instanceStore = protoInstanceStore
		// If FlagAlertingSaveStateCompressed is enabled, ProtoInstanceDBStore is used,
		// which functions differently from InstanceDBStore. FlagAlertingSaveStatePeriodic is
		// not applicable to ProtoInstanceDBStore, so a warning is logged if it is set.
		if featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingSaveStatePeriodic) {
			logger.Warn("alertingSaveStatePeriodic is not used when alertingSaveStateCompressed feature flag enabled")
		}
	} else {
		logger.Info("Using simple database alert instance store")
		instanceStore = simpleInstanceStore
	}

	return instanceStore, state.NewMultiInstanceReader(logger, protoInstanceStore, simpleInstanceStore)
}

func initStatePersister(uaCfg setting.UnifiedAlertingSettings, cfg state.ManagerCfg, featureToggles featuremgmt.FeatureToggles) state.StatePersister {
	logger := log.New("ngalert.state.manager.persist")
	var statePersister state.StatePersister

	if featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingSaveStateCompressed) {
		logger.Info("Using rule state persister")
		statePersister = state.NewSyncRuleStatePersisiter(logger, cfg)
	} else if featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingSaveStatePeriodic) {
		logger.Info("Using periodic state persister")
		ticker := clock.New().Ticker(uaCfg.StatePeriodicSaveInterval)
		statePersister = state.NewAsyncStatePersister(logger, ticker, cfg)
	} else {
		logger.Info("Using sync state persister")
		statePersister = state.NewSyncStatePersisiter(logger, cfg)
	}

	return statePersister
}

func subscribeToFolderChanges(logger log.Logger, bus bus.Bus, dbStore api.RuleStore) {
	// if full path to the folder is changed, we update all alert rules in that folder to make sure that all peers (in HA mode) will update folder title and
	// clean up the current state
	bus.AddEventListener(func(ctx context.Context, evt *events.FolderFullPathUpdated) error {
		logger.Info("Got folder full path updated event. updating rules in the folders", "folderUIDs", evt.UIDs)
		updatedKeys, err := dbStore.IncreaseVersionForAllRulesInNamespaces(ctx, evt.OrgID, evt.UIDs)
		if err != nil {
			logger.Error("Failed to update alert rules in the folders after their full paths were changed", "error", err, "folderUIDs", evt.UIDs, "orgID", evt.OrgID)
			return err
		}
		logger.Info("Updated version for alert rules", "keys", updatedKeys)
		return nil
	})
}

// Run starts the scheduler and Alertmanager.
func (ng *AlertNG) Run(ctx context.Context) error {
	ng.Log.Debug("Starting", "execute_alerts", ng.Cfg.UnifiedAlerting.ExecuteAlerts)

	children, subCtx := errgroup.WithContext(ctx)

	children.Go(func() error {
		return ng.MultiOrgAlertmanager.Run(subCtx)
	})
	children.Go(func() error {
		return ng.AlertsRouter.Run(subCtx)
	})

	if ng.Cfg.UnifiedAlerting.ExecuteAlerts {
		// Only Warm() the state manager if we are actually executing alerts.
		// Doing so when we are not executing alerts is wasteful and could lead
		// to misleading rule status queries, as the status returned will be
		// always based on the state loaded from the database at startup, and
		// not the most recent evaluation state.
		//
		// Also note that this runs synchronously to ensure state is loaded
		// before rule evaluation begins, hence we use ctx and not subCtx.
		//
		ng.stateManager.Warm(ctx, ng.store, ng.store, ng.StartupInstanceReader)

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
	if ng.Cfg == nil {
		return true
	}

	return !ng.Cfg.UnifiedAlerting.IsEnabled()
}

// GetHooks returns a facility for replacing handlers for paths. The handler hook for a path
// is invoked after all other middleware is invoked (authentication, instrumentation).
func (ng *AlertNG) GetHooks() *api.Hooks {
	return ng.Api.Hooks
}

type Historian interface {
	api.Historian
	state.Historian
}

func configureHistorianBackend(ctx context.Context, cfg setting.UnifiedAlertingStateHistorySettings, ar annotations.Repository, ds dashboards.DashboardService, rs historian.RuleStore, met *metrics.Historian, l log.Logger, tracer tracing.Tracer, ac historian.AccessControl) (Historian, error) {
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
		primary, err := configureHistorianBackend(ctx, primaryCfg, ar, ds, rs, met, l, tracer, ac)
		if err != nil {
			return nil, fmt.Errorf("multi-backend target \"%s\" was misconfigured: %w", cfg.MultiPrimary, err)
		}

		var secondaries []historian.Backend
		for _, b := range cfg.MultiSecondaries {
			secCfg := cfg
			secCfg.Backend = b
			sec, err := configureHistorianBackend(ctx, secCfg, ar, ds, rs, met, l, tracer, ac)
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
		annotationBackendLogger := log.New("ngalert.state.historian", "backend", "annotations")
		return historian.NewAnnotationBackend(annotationBackendLogger, store, rs, met, ac), nil
	}
	if backend == historian.BackendTypeLoki {
		lcfg, err := historian.NewLokiConfig(cfg)
		if err != nil {
			return nil, fmt.Errorf("invalid remote loki configuration: %w", err)
		}
		req := historian.NewRequester()
		lokiBackendLogger := log.New("ngalert.state.historian", "backend", "loki")
		backend := historian.NewRemoteLokiBackend(lokiBackendLogger, lcfg, req, met, tracer, rs, ac)

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

func createRemoteAlertmanager(cfg remote.AlertmanagerConfig, kvstore kvstore.KVStore, decryptFn remote.DecryptFn, autogenFn remote.AutogenFn, m *metrics.RemoteAlertmanager, tracer tracing.Tracer) (*remote.Alertmanager, error) {
	return remote.NewAlertmanager(cfg, notifier.NewFileStore(cfg.OrgID, kvstore), decryptFn, autogenFn, m, tracer)
}

func createRecordingWriter(featureToggles featuremgmt.FeatureToggles, settings setting.RecordingRuleSettings, httpClientProvider httpclient.Provider, clock clock.Clock, m *metrics.RemoteWriter) (schedule.RecordingWriter, error) {
	logger := log.New("ngalert.writer")

	if settings.Enabled {
		return writer.NewPrometheusWriter(settings, httpClientProvider, clock, logger, m)
	}

	return writer.NoopWriter{}, nil
}
