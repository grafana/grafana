package ngalert

import (
	"context"
	"net/url"

	"github.com/benbjohnson/clock"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/bus"
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
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/schedule"
	"github.com/grafana/grafana/pkg/services/ngalert/state"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/rendering"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(cfg *setting.Cfg, dataSourceCache datasources.CacheService, routeRegister routing.RouteRegister,
	sqlStore *sqlstore.SQLStore, kvStore kvstore.KVStore, expressionService *expr.Service, dataProxy *datasourceproxy.DataSourceProxyService,
	quotaService *quota.QuotaService, secretsService secrets.Service, notificationService notifications.Service, m *metrics.NGAlert,
	folderService dashboards.FolderService, ac accesscontrol.AccessControl, dashboardService dashboards.DashboardService, renderService rendering.Service,
	bus bus.Bus) (*AlertNG, error) {
	ng := &AlertNG{
		Cfg:                 cfg,
		DataSourceCache:     dataSourceCache,
		RouteRegister:       routeRegister,
		SQLStore:            sqlStore,
		KVStore:             kvStore,
		ExpressionService:   expressionService,
		DataProxy:           dataProxy,
		QuotaService:        quotaService,
		SecretsService:      secretsService,
		Metrics:             m,
		Log:                 log.New("ngalert"),
		NotificationService: notificationService,
		folderService:       folderService,
		accesscontrol:       ac,
		dashboardService:    dashboardService,
		renderService:       renderService,
		bus:                 bus,
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
	RouteRegister       routing.RouteRegister
	SQLStore            *sqlstore.SQLStore
	KVStore             kvstore.KVStore
	ExpressionService   *expr.Service
	DataProxy           *datasourceproxy.DataSourceProxyService
	QuotaService        *quota.QuotaService
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
	accesscontrol        accesscontrol.AccessControl

	bus bus.Bus
}

func (ng *AlertNG) init() error {
	var err error

	store := &store.DBstore{
		BaseInterval:     ng.Cfg.UnifiedAlerting.BaseInterval,
		DefaultInterval:  ng.Cfg.UnifiedAlerting.DefaultRuleEvaluationInterval,
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
		return err
	}

	schedCfg := schedule.SchedulerCfg{
		C:                       clock.New(),
		BaseInterval:            ng.Cfg.UnifiedAlerting.BaseInterval,
		Logger:                  ng.Log,
		MaxAttempts:             ng.Cfg.UnifiedAlerting.MaxAttempts,
		Evaluator:               eval.NewEvaluator(ng.Cfg, ng.Log, ng.DataSourceCache, ng.SecretsService),
		InstanceStore:           store,
		RuleStore:               store,
		AdminConfigStore:        store,
		OrgStore:                store,
		MultiOrgNotifier:        ng.MultiOrgAlertmanager,
		Metrics:                 ng.Metrics.GetSchedulerMetrics(),
		AdminConfigPollInterval: ng.Cfg.UnifiedAlerting.AdminConfigPollInterval,
		DisabledOrgs:            ng.Cfg.UnifiedAlerting.DisabledOrgs,
		MinRuleInterval:         ng.Cfg.UnifiedAlerting.MinInterval,
	}

	appUrl, err := url.Parse(ng.Cfg.AppURL)
	if err != nil {
		ng.Log.Error("Failed to parse application URL. Continue without it.", "err", err)
		appUrl = nil
	}

	stateManager := state.NewManager(ng.Log, ng.Metrics.GetStateMetrics(), appUrl, store, store, ng.SQLStore, ng.dashboardService, ng.imageService)
	scheduler := schedule.NewScheduler(schedCfg, ng.ExpressionService, appUrl, stateManager, ng.bus)

	ng.stateManager = stateManager
	ng.schedule = scheduler

	// Provisioning
	policyService := provisioning.NewNotificationPolicyService(store, store, store, ng.Log)
	contactPointService := provisioning.NewContactPointService(store, ng.SecretsService, store, store, ng.Log)
	templateService := provisioning.NewTemplateService(store, store, store, ng.Log)
	muteTimingService := provisioning.NewMuteTimingService(store, store, store, ng.Log)
	alertRuleService := provisioning.NewAlertRuleService(store, store, store,
		int64(ng.Cfg.UnifiedAlerting.DefaultRuleEvaluationInterval.Seconds()),
		int64(ng.Cfg.UnifiedAlerting.BaseInterval.Seconds()), ng.Log)

	api := api.API{
		Cfg:                  ng.Cfg,
		DatasourceCache:      ng.DataSourceCache,
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
	}
	api.RegisterAPIEndpoints(ng.Metrics.GetAPIMetrics())

	return DeclareFixedRoles(ng.accesscontrol)
}

// Run starts the scheduler and Alertmanager.
func (ng *AlertNG) Run(ctx context.Context) error {
	ng.Log.Debug("ngalert starting")
	ng.stateManager.Warm(ctx)

	children, subCtx := errgroup.WithContext(ctx)

	if ng.Cfg.UnifiedAlerting.ExecuteAlerts {
		children.Go(func() error {
			return ng.schedule.Run(subCtx)
		})
	}
	children.Go(func() error {
		return ng.MultiOrgAlertmanager.Run(subCtx)
	})
	return children.Wait()
}

// IsDisabled returns true if the alerting service is disable for this instance.
func (ng *AlertNG) IsDisabled() bool {
	if ng.Cfg == nil {
		return true
	}
	return !ng.Cfg.UnifiedAlerting.IsEnabled()
}
