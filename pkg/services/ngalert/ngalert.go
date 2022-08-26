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
	"github.com/grafana/grafana/pkg/infra/kvstore"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasourceproxy"
	"github.com/grafana/grafana/pkg/services/datasources"
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
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, dataSourceCache datasources.CacheService, dataSourceService datasources.DataSourceService, routeRegister routing.RouteRegister,
	sqlStore *sqlstore.SQLStore, kvStore kvstore.KVStore, expressionService *expr.Service, dataProxy *datasourceproxy.DataSourceProxyService,
	quotaService quota.Service, secretsService secrets.Service, notificationService notifications.Service, m *metrics.NGAlert,
	folderService dashboards.FolderService, ac accesscontrol.AccessControl, dashboardService dashboards.DashboardService, renderService rendering.Service,
	bus bus.Bus, accesscontrolService accesscontrol.Service) (*AlertNG, error) {
	ng := &AlertNG{
		Cfg:                  cfg,
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
	DataSourceCache     datasources.CacheService
	DataSourceService   datasources.DataSourceService
	RouteRegister       routing.RouteRegister
	SQLStore            *sqlstore.SQLStore
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
	folderService       dashboards.FolderService
	dashboardService    dashboards.DashboardService

	// Alerting notification services
	MultiOrgAlertmanager *notifier.MultiOrgAlertmanager
	AlertsRouter         *sender.AlertsRouter
	accesscontrol        accesscontrol.AccessControl
	accesscontrolService accesscontrol.Service

	bus bus.Bus
}

func (ng *AlertNG) init() error {
	var err error

	store := &store.DBstore{
		Cfg:              ng.Cfg.UnifiedAlerting,
		SQLStore:         ng.SQLStore,
		Logger:           ng.Log,
		FolderService:    ng.folderService,
		AccessControl:    ng.accesscontrol,
		DashboardService: ng.dashboardService,
	}

	decryptFn := ng.SecretsService.GetDecryptedValue
	multiOrgMetrics := ng.Metrics.GetMultiOrgAlertmanagerMetrics()
	ng.MultiOrgAlertmanager, err = notifier.NewMultiOrgAlertmanager(ng.Cfg, store, store, ng.KVStore, store, decryptFn, multiOrgMetrics, ng.NotificationService, log.New("ngalert.multiorg.alertmanager"), ng.SecretsService)
	if err != nil {
		return err
	}

	imageService, err := image.NewScreenshotImageServiceFromCfg(ng.Cfg, ng.Metrics.Registerer, store, ng.dashboardService, ng.renderService)
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
		ng.Log.Error("Failed to parse application URL. Continue without it.", "err", err)
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

	schedCfg := schedule.SchedulerCfg{
		Cfg:           ng.Cfg.UnifiedAlerting,
		C:             clk,
		Logger:        ng.Log,
		Evaluator:     eval.NewEvaluator(ng.Cfg, ng.Log, ng.DataSourceCache, ng.SecretsService, ng.ExpressionService),
		InstanceStore: store,
		RuleStore:     store,
		Metrics:       ng.Metrics.GetSchedulerMetrics(),
		AlertSender:   alertsRouter,
	}

	stateManager := state.NewManager(ng.Log, ng.Metrics.GetStateMetrics(), appUrl, store, store, ng.dashboardService, ng.imageService, clk)
	scheduler := schedule.NewScheduler(schedCfg, appUrl, stateManager)

	// if it is required to include folder title to the alerts, we need to subscribe to changes of alert title
	if !ng.Cfg.UnifiedAlerting.ReservedLabels.IsReservedLabelDisabled(models.FolderTitleLabel) {
		subscribeToFolderChanges(ng.Log, ng.bus, store, scheduler)
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
		ExpressionService:    ng.ExpressionService,
		Schedule:             ng.schedule,
		DataProxy:            ng.DataProxy,
		QuotaService:         ng.QuotaService,
		SecretsService:       ng.SecretsService,
		TransactionManager:   store,
		InstanceStore:        store,
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
	}
	api.RegisterAPIEndpoints(ng.Metrics.GetAPIMetrics())

	return DeclareFixedRoles(ng.accesscontrolService)
}

func subscribeToFolderChanges(logger log.Logger, bus bus.Bus, dbStore store.RuleStore, scheduler schedule.ScheduleService) {
	// if folder title is changed, we update all alert rules in that folder to make sure that all peers (in HA mode) will update folder title and
	// clean up the current state
	bus.AddEventListener(func(ctx context.Context, e *events.FolderTitleUpdated) error {
		// do not block the upstream execution
		go func(evt *events.FolderTitleUpdated) {
			logger.Debug("Got folder title updated event. updating rules in the folder", "folder_uid", evt.UID)
			updated, err := dbStore.IncreaseVersionForAllRulesInNamespace(context.Background(), evt.OrgID, evt.UID)
			if err != nil {
				logger.Error("Failed to update alert rules in the folder after its title was changed", "err", err, "folder_uid", evt.UID, "folder", evt.Title)
				return
			}
			if len(updated) > 0 {
				logger.Debug("rules that belong to the folder have been updated successfully. clearing their status", "updated_rules", len(updated))
				for _, key := range updated {
					scheduler.UpdateAlertRule(key.AlertRuleKey, key.Version)
				}
			} else {
				logger.Debug("no alert rules found in the folder. nothing to update", "folder_uid", evt.UID, "folder", evt.Title)
			}
		}(e)
		return nil
	})
}

// Run starts the scheduler and Alertmanager.
func (ng *AlertNG) Run(ctx context.Context) error {
	ng.Log.Debug("ngalert starting")
	ng.stateManager.Warm(ctx)

	children, subCtx := errgroup.WithContext(ctx)

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
