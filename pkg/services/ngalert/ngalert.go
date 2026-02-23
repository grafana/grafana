package ngalert

import (
	"context"
	"fmt"
	"net/url"
	"time"

	"github.com/benbjohnson/clock"
	notificationHistorian "github.com/grafana/alerting/notify/historian"
	"github.com/grafana/alerting/notify/historian/lokiclient"
	"github.com/grafana/alerting/notify/nfstatus"
	"github.com/prometheus/alertmanager/featurecontrol"
	"github.com/prometheus/alertmanager/matchers/compat"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/services/ngalert/lokiconfig"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/inhibition_rules"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/routes"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"

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
	apiprometheus "github.com/grafana/grafana/pkg/services/ngalert/api/prometheus"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/cluster"
	"github.com/grafana/grafana/pkg/services/ngalert/eval"
	"github.com/grafana/grafana/pkg/services/ngalert/image"
	"github.com/grafana/grafana/pkg/services/ngalert/metrics"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/remote"
	remoteClient "github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/sender"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/state/historian"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/writer"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
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
	pluginContextProvider *plugincontext.Provider,
	resourcePermissions accesscontrol.ReceiverPermissionsService,
	userService user.Service,
) (*AlertNG, error) {
	ng := &AlertNG{
		Cfg:                   cfg,
		FeatureToggles:        featureToggles,
		DataSourceCache:       dataSourceCache,
		DataSourceService:     dataSourceService,
		RouteRegister:         routeRegister,
		SQLStore:              sqlStore,
		KVStore:               kvStore,
		ExpressionService:     expressionService,
		DataProxy:             dataProxy,
		QuotaService:          quotaService,
		SecretsService:        secretsService,
		Metrics:               m,
		Log:                   log.New("ngalert"),
		NotificationService:   notificationService,
		folderService:         folderService,
		accesscontrol:         ac,
		dashboardService:      dashboardService,
		renderService:         renderService,
		bus:                   bus,
		AccesscontrolService:  accesscontrolService,
		annotationsRepo:       annotationsRepo,
		pluginsStore:          pluginsStore,
		tracer:                tracer,
		store:                 ruleStore,
		httpClientProvider:    httpClientProvider,
		pluginContextProvider: pluginContextProvider,
		ResourcePermissions:   resourcePermissions,
		userService:           userService,
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
	Cfg                   *setting.Cfg
	FeatureToggles        featuremgmt.FeatureToggles
	DataSourceCache       datasources.CacheService
	DataSourceService     datasources.DataSourceService
	RouteRegister         routing.RouteRegister
	SQLStore              db.DB
	KVStore               kvstore.KVStore
	ExpressionService     *expr.Service
	DataProxy             *datasourceproxy.DataSourceProxyService
	QuotaService          quota.Service
	SecretsService        secrets.Service
	Metrics               *metrics.NGAlert
	NotificationService   notifications.Service
	Log                   log.Logger
	renderService         rendering.Service
	ImageService          image.ImageService
	RecordingWriter       schedule.RecordingWriter
	schedule              schedule.ScheduleService
	stateManager          *state.Manager
	folderService         folder.Service
	dashboardService      dashboards.DashboardService
	Api                   *api.API
	httpClientProvider    httpclient.Provider
	pluginContextProvider *plugincontext.Provider
	InstanceStore         state.InstanceStore
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

	evaluationCoordinator EvaluationCoordinator
	schedCfg              schedule.SchedulerCfg
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

	// Configure the remote Alertmanager.
	// If toggles for both modes are enabled, remote primary takes precedence.
	var opts []notifier.Option
	moaLogger := log.New("ngalert.multiorg.alertmanager")
	crypto := notifier.NewCrypto(ng.SecretsService, ng.store, moaLogger)
	//nolint:staticcheck // not yet migrated to OpenFeature
	remotePrimary := ng.FeatureToggles.IsEnabled(initCtx, featuremgmt.FlagAlertmanagerRemotePrimary)
	//nolint:staticcheck // not yet migrated to OpenFeature
	remoteSecondary := ng.FeatureToggles.IsEnabled(initCtx, featuremgmt.FlagAlertmanagerRemoteSecondary)
	//nolint:staticcheck // not yet migrated to OpenFeature
	remoteSecondaryWithRemoteState := ng.FeatureToggles.IsEnabled(initCtx, featuremgmt.FlagAlertmanagerRemoteSecondaryWithRemoteState)
	if remotePrimary || remoteSecondary || remoteSecondaryWithRemoteState {
		m := ng.Metrics.GetRemoteAlertmanagerMetrics()
		smtpCfg := remoteClient.SmtpConfig{
			FromAddress:    ng.Cfg.Smtp.FromAddress,
			FromName:       ng.Cfg.Smtp.FromName,
			Host:           ng.Cfg.Smtp.Host,
			User:           ng.Cfg.Smtp.User,
			Password:       ng.Cfg.Smtp.Password,
			EhloIdentity:   ng.Cfg.Smtp.EhloIdentity,
			StartTLSPolicy: ng.Cfg.Smtp.StartTLSPolicy,
			SkipVerify:     ng.Cfg.Smtp.SkipVerify,
			StaticHeaders:  ng.Cfg.Smtp.StaticHeaders,
		}
		runtimeConfig := remoteClient.RuntimeConfig{
			DispatchTimer: notifier.GetDispatchTimer(ng.FeatureToggles).String(),
		}

		cfg := remote.AlertmanagerConfig{
			BasicAuthPassword: ng.Cfg.UnifiedAlerting.RemoteAlertmanager.Password,
			DefaultConfig:     ng.Cfg.UnifiedAlerting.DefaultConfiguration,
			TenantID:          ng.Cfg.UnifiedAlerting.RemoteAlertmanager.TenantID,
			URL:               ng.Cfg.UnifiedAlerting.RemoteAlertmanager.URL,
			ExternalURL:       ng.Cfg.AppURL,
			SmtpConfig:        smtpCfg,
			Timeout:           ng.Cfg.UnifiedAlerting.RemoteAlertmanager.Timeout,
			RuntimeConfig:     runtimeConfig,
		}
		autogenFn := func(ctx context.Context, logger log.Logger, orgID int64, cfg *definitions.PostableApiAlertingConfig, invalidReceiverAction notifier.InvalidReceiversAction) error {
			return notifier.AddAutogenConfig(ctx, logger, ng.store, orgID, cfg, invalidReceiverAction, ng.FeatureToggles)
		}

		// This function will be used by the MOA to create new Alertmanagers.
		var override func(notifier.OrgAlertmanagerFactory) notifier.OrgAlertmanagerFactory

		if remotePrimary {
			ng.Log.Debug("Starting Grafana with remote primary mode enabled")
			m.Info.WithLabelValues(metrics.ModeRemotePrimary).Set(1)
			override = remote.NewRemotePrimaryFactory(cfg, ng.KVStore, crypto, autogenFn, m, ng.tracer, ng.FeatureToggles)
		} else {
			ng.Log.Debug("Starting Grafana with remote secondary mode enabled")
			m.Info.WithLabelValues(metrics.ModeRemoteSecondary).Set(1)
			override = remote.NewRemoteSecondaryFactory(cfg,
				ng.KVStore,
				ng.store,
				ng.Cfg.UnifiedAlerting.RemoteAlertmanager.SyncInterval,
				crypto,
				autogenFn,
				m,
				ng.tracer,
				remoteSecondaryWithRemoteState,
				ng.FeatureToggles,
			)
		}

		opts = append(opts, notifier.WithAlertmanagerOverride(override))
	}

	notificationHistorian, err := configureNotificationHistorian(
		initCtx,
		ng.FeatureToggles,
		ng.Cfg.UnifiedAlerting.NotificationHistory,
		ng.Metrics.GetNotificationHistorianMetrics(),
		ng.Log,
		ng.tracer,
	)
	if err != nil {
		return err
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
		notificationHistorian,
		opts...,
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
		ng.Cfg.UnifiedAlerting.AdminConfigPollInterval, ng.DataSourceService, ng.SecretsService, ng.FeatureToggles,
		ng.Cfg.UnifiedAlerting.HASingleNodeEvaluation)

	// Make sure we sync at least once as Grafana starts to get the router up and running before we start sending any alerts.
	if err := alertsRouter.SyncAndApplyConfigFromDatabase(initCtx); err != nil {
		return fmt.Errorf("failed to initialize alerting because alert notifications router failed to warm up: %w", err)
	}

	ng.AlertsRouter = alertsRouter

	evalFactory := eval.NewEvaluatorFactory(ng.Cfg.UnifiedAlerting, ng.DataSourceCache, ng.ExpressionService)
	conditionValidator := eval.NewConditionValidator(ng.DataSourceCache, ng.ExpressionService, ng.pluginsStore)

	recordingWriter, err := createRecordingWriter(ng.Cfg.UnifiedAlerting.RecordingRules, ng.httpClientProvider, ng.DataSourceService, ng.pluginContextProvider, clk, ng.Metrics.GetRemoteWriterMetrics())
	if err != nil {
		return fmt.Errorf("failed to initialize recording writer: %w", err)
	}
	ng.RecordingWriter = recordingWriter

	ng.schedCfg = schedule.SchedulerCfg{
		RetryConfig: schedule.RetryConfig{
			MaxAttempts:         ng.Cfg.UnifiedAlerting.MaxAttempts,
			InitialRetryDelay:   ng.Cfg.UnifiedAlerting.InitialRetryDelay,
			MaxRetryDelay:       ng.Cfg.UnifiedAlerting.MaxRetryDelay,
			RandomizationFactor: ng.Cfg.UnifiedAlerting.RandomizationFactor,
		},
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
		FeatureToggles:       ng.FeatureToggles,
	}

	history, err := configureHistorianBackend(
		initCtx,
		ng.Cfg.UnifiedAlerting.StateHistory,
		ng.Cfg.AnnotationMaximumTagsLength,
		ng.annotationsRepo,
		ng.dashboardService,
		ng.store,
		ng.Metrics.GetHistorianMetrics(),
		ng.Log,
		ng.tracer,
		ac.NewRuleService(ng.accesscontrol),
		ng.DataSourceService,
		ng.httpClientProvider,
		ng.pluginContextProvider,
		clk,
		ng.Metrics.GetRemoteWriterMetrics(),
	)
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
		MaxStateSaveConcurrency:        ng.Cfg.UnifiedAlerting.MaxStateSaveConcurrency,
		StatePeriodicSaveBatchSize:     ng.Cfg.UnifiedAlerting.StatePeriodicSaveBatchSize,
		StatePeriodicSaveJitterEnabled: ng.Cfg.UnifiedAlerting.StatePeriodicSaveJitterEnabled,
		StatePeriodicSaveInterval:      ng.Cfg.UnifiedAlerting.StatePeriodicSaveInterval,
		RulesPerRuleGroupLimit:         ng.Cfg.UnifiedAlerting.RulesPerRuleGroupLimit,
		Tracer:                         ng.tracer,
		Log:                            log.New("ngalert.state.manager"),
		ResolvedRetention:              ng.Cfg.UnifiedAlerting.ResolvedAlertRetention,

		IgnorePendingForNoDataAndError: ng.Cfg.IsFeatureToggleEnabled(featuremgmt.FlagAlertingIgnorePendingForNoDataAndError),
	}
	statePersister := initStatePersister(ng.Cfg.UnifiedAlerting, stateManagerCfg, ng.FeatureToggles)
	ng.stateManager = state.NewManager(stateManagerCfg, statePersister)

	// if it is required to include folder title to the alerts, we need to subscribe to changes of alert title
	if !ng.Cfg.UnifiedAlerting.ReservedLabels.IsReservedLabelDisabled(models.FolderTitleLabel) {
		subscribeToFolderChanges(ng.Log, ng.bus, ng.store)
	}

	var apiStateManager state.AlertInstanceManager
	var apiStatusReader apiprometheus.StatusReader
	if ng.Cfg.UnifiedAlerting.HASingleNodeEvaluation {
		peer := ng.MultiOrgAlertmanager.Peer()
		if peer == nil {
			return fmt.Errorf("single-node evaluation in HA mode requires HA clustering to be enabled")
		}
		var err error
		ng.evaluationCoordinator, err = cluster.NewEvaluationCoordinator(peer, ng.Log)
		if err != nil {
			return fmt.Errorf("failed to create evaluation coordinator: %w", err)
		}

		// Use StoreStateReader to serve rule statuses / alert instances from the database,
		// because non-primary nodes have no in-memory state
		storeStateReader := state.NewStoreStateReader(ng.InstanceStore, ng.Log)
		apiStateManager = storeStateReader
		apiStatusReader = storeStateReader
	} else {
		// No need for a real evaluation coordinator in non-HA mode.
		ng.evaluationCoordinator = cluster.NewNoopEvaluationCoordinator()

		// Use in-memory state/scheduler for API calls
		apiStateManager = ng.stateManager
		ng.schedule = schedule.NewScheduler(ng.schedCfg, ng.stateManager)
		apiStatusReader = ng.schedule
	}

	configStore := legacy_storage.NewAlertmanagerConfigStore(ng.store, notifier.NewExtraConfigsCrypto(ng.SecretsService), ng.FeatureToggles)

	routeService := routes.NewService(configStore, ng.store, ng.store, ng.Cfg.UnifiedAlerting, ng.FeatureToggles, ng.Log, validation.ValidateProvenanceRelaxed, ng.tracer)

	receiverAccess := ac.NewReceiverAccess[*models.Receiver](ng.accesscontrol, false)
	receiverService := notifier.NewReceiverService(
		receiverAccess,
		configStore,
		ng.store,
		ng.store,
		routeService,
		ng.SecretsService,
		ng.store,
		ng.Log,
		ng.ResourcePermissions,
		ng.tracer,
		//nolint:staticcheck // not yet migrated to OpenFeature
		ng.FeatureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingImportAlertmanagerAPI),
	)
	receiverTestService := notifier.NewReceiverTestingService(
		receiverService,
		ng.MultiOrgAlertmanager,
		ng.SecretsService,
		receiverAccess,
	)

	provisioningReceiverService := notifier.NewReceiverService(
		ac.NewReceiverAccess[*models.Receiver](ng.accesscontrol, true),
		configStore,
		ng.store,
		ng.store,
		routeService,
		ng.SecretsService,
		ng.store,
		ng.Log,
		ng.ResourcePermissions,
		ng.tracer,
		false, // imported resources are not exposed via provisioning APIs
	)

	// Provisioning
	policyService := provisioning.NewNotificationPolicyService(configStore, ng.store, ng.store, ng.Cfg.UnifiedAlerting, ng.Log)
	contactPointService := provisioning.NewContactPointService(configStore, ng.SecretsService, ng.store, ng.store, provisioningReceiverService, ng.Log, ng.store, ng.ResourcePermissions)
	templateService := provisioning.NewTemplateService(configStore, ng.store, ng.store, ng.Log)
	muteTimingService := provisioning.NewMuteTimingService(configStore, ng.store, ng.store, ng.Log, ng.store, routeService)
	inhibitionRuleService := inhibition_rules.NewService(configStore, ng.Log, ng.FeatureToggles)
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
		StateManager:         apiStateManager,
		RuleStatusReader:     apiStatusReader,
		AccessControl:        ng.accesscontrol,
		Policies:             policyService,
		RouteService:         routeService,
		ReceiverService:      receiverService,
		ReceiverTestService:  receiverTestService,
		ContactPointService:  contactPointService,
		Templates:            templateService,
		MuteTimings:          muteTimingService,
		InhibitionRules:      inhibitionRuleService,
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
	//nolint:staticcheck // not yet migrated to OpenFeature
	if featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingSaveStateCompressed) {
		logger.Info("Using protobuf-based alert instance store")
		instanceStore = protoInstanceStore
	} else {
		logger.Info("Using simple database alert instance store")
		instanceStore = simpleInstanceStore
	}

	return instanceStore, state.NewMultiInstanceReader(logger, protoInstanceStore, simpleInstanceStore)
}

func initStatePersister(uaCfg setting.UnifiedAlertingSettings, cfg state.ManagerCfg, featureToggles featuremgmt.FeatureToggles) state.StatePersister {
	logger := log.New("ngalert.state.manager.persist")

	//nolint:staticcheck // not yet migrated to OpenFeature
	compressed := featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingSaveStateCompressed)
	//nolint:staticcheck // not yet migrated to OpenFeature
	periodic := featureToggles.IsEnabledGlobally(featuremgmt.FlagAlertingSaveStatePeriodic)

	switch {
	case compressed && periodic:
		logger.Info("Using async rule state persister (compressed + periodic)")
		return state.NewAsyncRuleStatePersister(logger, clock.New(), cfg.StatePeriodicSaveInterval, cfg)
	case compressed:
		logger.Info("Using sync rule state persister (compressed)")
		return state.NewSyncRuleStatePersister(logger, cfg)
	case periodic:
		logger.Info("Using async state persister (periodic)")
		return state.NewAsyncStatePersister(logger, clock.New(), uaCfg.StatePeriodicSaveInterval, cfg)
	default:
		logger.Info("Using sync state persister")
		return state.NewSyncStatePersisiter(logger, cfg)
	}
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
		children.Go(func() error {
			runner := &evaluationRunner{ng: ng}
			return runner.run(subCtx)
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

func configureHistorianBackend(
	ctx context.Context,
	cfg setting.UnifiedAlertingStateHistorySettings,
	annotationMaxTagsLength int64,
	ar annotations.Repository,
	ds dashboards.DashboardService,
	rs historian.RuleStore,
	met *metrics.Historian,
	l log.Logger,
	tracer tracing.Tracer,
	ac historian.AccessControl,
	datasourceService datasources.DataSourceService,
	httpClientProvider httpclient.Provider,
	pluginContextProvider *plugincontext.Provider,
	clock clock.Clock,
	mw *metrics.RemoteWriter,
) (Historian, error) {
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
		primary, err := configureHistorianBackend(ctx, primaryCfg, annotationMaxTagsLength, ar, ds, rs, met, l, tracer, ac, datasourceService, httpClientProvider, pluginContextProvider, clock, mw)
		if err != nil {
			return nil, fmt.Errorf("multi-backend target \"%s\" was misconfigured: %w", cfg.MultiPrimary, err)
		}

		var secondaries []historian.Backend
		for _, b := range cfg.MultiSecondaries {
			secCfg := cfg
			secCfg.Backend = b
			sec, err := configureHistorianBackend(ctx, secCfg, annotationMaxTagsLength, ar, ds, rs, met, l, tracer, ac, datasourceService, httpClientProvider, pluginContextProvider, clock, mw)
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
		logCtx := log.WithContextualAttributes(ctx, []any{"backend", "annotations"})
		annotationBackendLogger := log.New("ngalert.state.historian").FromContext(logCtx)
		return historian.NewAnnotationBackend(annotationBackendLogger, store, rs, met, ac, annotationMaxTagsLength), nil
	}
	if backend == historian.BackendTypeLoki {
		lcfg, err := lokiconfig.NewLokiConfig(cfg.LokiSettings)
		if err != nil {
			return nil, fmt.Errorf("invalid remote loki configuration: %w", err)
		}
		// Use external labels from state history config
		lcfg.ExternalLabels = cfg.ExternalLabels
		req := lokiclient.NewRequester()
		logCtx := log.WithContextualAttributes(ctx, []any{"backend", "loki"})
		lokiBackendLogger := log.New("ngalert.state.historian").FromContext(logCtx)
		backend := historian.NewRemoteLokiBackend(lokiBackendLogger, lcfg, req, met, tracer, rs, ac)

		testConnCtx, cancelFunc := context.WithTimeout(ctx, 10*time.Second)
		defer cancelFunc()
		if err := backend.TestConnection(testConnCtx); err != nil {
			l.Error("Failed to communicate with configured remote Loki backend, state history may not be persisted", "error", err)
		}
		return backend, nil
	}

	if backend == historian.BackendTypePrometheus {
		pcfg, err := historian.NewPrometheusConfig(cfg)
		if err != nil {
			return nil, fmt.Errorf("invalid remote prometheus configuration: %w", err)
		}
		writerCfg := writer.DatasourceWriterConfig{
			Timeout: cfg.PrometheusWriteTimeout,
		}
		logCtx := log.WithContextualAttributes(ctx, []any{"backend", "prometheus"})
		prometheusBackendLogger := log.New("ngalert.state.historian").FromContext(logCtx)
		w := writer.NewDatasourceWriter(writerCfg, datasourceService, httpClientProvider, pluginContextProvider, clock, prometheusBackendLogger, mw)
		if w == nil {
			return nil, fmt.Errorf("failed to create alert state metrics writer")
		}
		backend := historian.NewRemotePrometheusBackend(pcfg, w, prometheusBackendLogger, met)

		return backend, nil
	}

	return nil, fmt.Errorf("unrecognized state history backend: %s", backend)
}

func configureNotificationHistorian(
	ctx context.Context,
	featureToggles featuremgmt.FeatureToggles,
	cfg setting.UnifiedAlertingNotificationHistorySettings,
	met *metrics.NotificationHistorian,
	l log.Logger,
	tracer tracing.Tracer,
) (nfstatus.NotificationHistorian, error) {
	//nolint:staticcheck // not yet migrated to OpenFeature
	if !featureToggles.IsEnabled(ctx, featuremgmt.FlagAlertingNotificationHistory) || !cfg.Enabled {
		met.Info.Set(0)
		return nil, nil
	}

	met.Info.Set(1)
	lcfg, err := lokiconfig.NewLokiConfig(cfg.LokiSettings)
	if err != nil {
		return nil, fmt.Errorf("invalid remote loki configuration: %w", err)
	}
	req := lokiclient.NewRequester()
	logger := log.New("ngalert.notifier.historian").FromContext(ctx)
	nh := notificationHistorian.NewNotificationHistorian(logger, lcfg, req, met.BytesWritten, met.WriteDuration, met.WritesTotal, met.WritesFailed, tracer)

	testConnCtx, cancelFunc := context.WithTimeout(ctx, 10*time.Second)
	defer cancelFunc()
	if err := nh.TestConnection(testConnCtx); err != nil {
		l.Error("Failed to communicate with configured remote Loki backend, notification history may not be persisted", "error", err)
	}
	return nh, nil
}

func createRecordingWriter(settings setting.RecordingRuleSettings, httpClientProvider httpclient.Provider, datasourceService datasources.DataSourceService, pluginContextProvider *plugincontext.Provider, clock clock.Clock, m *metrics.RemoteWriter) (schedule.RecordingWriter, error) {
	logger := log.New("ngalert.writer")

	if settings.Enabled {
		cfg := writer.DatasourceWriterConfig{
			Timeout:              settings.Timeout,
			CustomHeaders:        settings.CustomHeaders,
			DefaultDatasourceUID: settings.DefaultDatasourceUID,
		}

		logger.Info("Setting up remote write using data sources",
			"timeout", cfg.Timeout, "default_datasource_uid", cfg.DefaultDatasourceUID)

		return writer.NewDatasourceWriter(cfg, datasourceService, httpClientProvider, pluginContextProvider, clock, logger, m), nil
	}

	return writer.NoopWriter{}, nil
}
