package ngalert

import (
	"context"
	"fmt"
	"net/url"

	"github.com/benbjohnson/clock"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/events"
	"github.com/grafana/grafana/pkg/expr"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
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

	// Alerting notification services
	MultiOrgAlertmanager *notifier.MultiOrgAlertmanager
	AlertsRouter         *sender.AlertsRouter
	accesscontrol        accesscontrol.AccessControl
	accesscontrolService accesscontrol.Service
	annotationsRepo      annotations.Repository
	store                *store.DBstore

	bus bus.Bus
}

func (ng *AlertNG) init() error {
	var err error

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
	if err := ng.MultiOrgAlertmanager.LoadAndSyncAlertmanagersForOrgs(context.Background()); err != nil {
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

	evalFactory := eval.NewEvaluatorFactory(ng.Cfg.UnifiedAlerting, ng.DataSourceCache, ng.ExpressionService)
	schedCfg := schedule.SchedulerCfg{
		Cfg:              ng.Cfg.UnifiedAlerting,
		C:                clk,
		EvaluatorFactory: evalFactory,
		RuleStore:        store,
		Metrics:          ng.Metrics.GetSchedulerMetrics(),
		AlertSender:      alertsRouter,
	}

	historian := historian.NewAnnotationHistorian(ng.annotationsRepo, ng.dashboardService)
	stateManager := state.NewManager(ng.Metrics.GetStateMetrics(), appUrl, store, ng.imageService, clk, historian)
	scheduler := schedule.NewScheduler(schedCfg, appUrl, stateManager)

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
	alertRuleService := provisioning.NewAlertRuleService(store, store, ng.QuotaService, store,
		int64(ng.Cfg.UnifiedAlerting.DefaultRuleEvaluationInterval.Seconds()),
		int64(ng.Cfg.UnifiedAlerting.BaseInterval.Seconds()), ng.Log)

	api := api.API{
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
	}
	api.RegisterAPIEndpoints(ng.Metrics.GetAPIMetrics())

	defaultLimits, err := readQuotaConfig(ng.Cfg)
	if err != nil {
		return err
	}

	if err := ng.QuotaService.RegisterQuotaReporter(&quota.NewUsageReporter{
		TargetSrv:     models.QuotaTargetSrv,
		DefaultLimits: defaultLimits,
		Reporter:      api.Usage,
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
			_, err := dbStore.IncreaseVersionForAllRulesInNamespace(context.Background(), evt.OrgID, evt.UID)
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

// IsDisabled returns true if the alerting service is disable for this instance.
func (ng *AlertNG) IsDisabled() bool {
	if ng.Cfg == nil {
		return true
	}
	return !ng.Cfg.UnifiedAlerting.IsEnabled()
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
