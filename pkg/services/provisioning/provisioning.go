package provisioning

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"sync"

	"github.com/grafana/dskit/services"
	"golang.org/x/sync/errgroup"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/serverlock"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/correlations"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards"
	datasourceservice "github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	alertingauthz "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/routes"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
	alertstore "github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	"github.com/grafana/grafana/pkg/services/promtypemigration"
	prov_alerting "github.com/grafana/grafana/pkg/services/provisioning/alerting"
	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning/datasources"
	"github.com/grafana/grafana/pkg/services/provisioning/plugins"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

const ServiceName = "provisioning"

func ProvideService(
	ac accesscontrol.AccessControl,
	cfg *setting.Cfg,
	sqlStore db.DB,
	pluginStore pluginstore.Store,
	alertingStore *alertstore.DBstore,
	encryptionService encryption.Internal,
	notificatonService *notifications.NotificationService,
	dashboardProvisioningService dashboardservice.DashboardProvisioningService,
	datasourceService datasourceservice.DataSourceService,
	correlationsService correlations.Service,
	dashboardService dashboardservice.DashboardService,
	folderService folder.Service,
	pluginSettings pluginsettings.Service,
	quotaService quota.Service,
	secrectService secrets.Service,
	orgService org.Service,
	userService user.Service,
	resourcePermissions accesscontrol.ReceiverPermissionsService,
	tracer tracing.Tracer,
	dual dualwrite.Service,
	promTypeMigrationProvider promtypemigration.PromTypeMigrationProvider,
	serverLockService *serverlock.ServerLockService,
	routesPermissions accesscontrol.RoutePermissionsService,
) (*ProvisioningServiceImpl, error) {
	s := &ProvisioningServiceImpl{
		Cfg:                          cfg,
		SQLStore:                     sqlStore,
		ac:                           ac,
		pluginStore:                  pluginStore,
		alertingStore:                alertingStore,
		EncryptionService:            encryptionService,
		NotificationService:          notificatonService,
		newDashboardProvisioner:      dashboards.New,
		provisionDatasources:         datasources.Provision,
		provisionPlugins:             plugins.Provision,
		provisionAlerting:            prov_alerting.Provision,
		dashboardProvisioningService: dashboardProvisioningService,
		dashboardService:             dashboardService,
		datasourceService:            datasourceService,
		correlationsService:          correlationsService,
		pluginsSettings:              pluginSettings,
		quotaService:                 quotaService,
		secretService:                secrectService,
		log:                          log.New("provisioning"),
		orgService:                   orgService,
		userService:                  userService,
		folderService:                folderService,
		resourcePermissions:          resourcePermissions,
		tracer:                       tracer,
		migratePrometheusType:        promTypeMigrationProvider.Run,
		dual:                         dual,
		serverLock:                   serverLockService,
		routesPermissions:            routesPermissions,
	}

	s.NamedService = services.NewBasicService(s.starting, s.running, nil).WithName(ServiceName)

	if err := s.setDashboardProvisioner(); err != nil {
		return nil, err
	}

	return s, nil
}

func (ps *ProvisioningServiceImpl) starting(ctx context.Context) error {
	// Startup provisioning runs concurrently in two stages:
	//   plugins ┃ (independent — runs parallel to everything)
	//   datasources ➜ {alerting, dashboards, migratePrometheusType}
	//
	// The per-service mutex held by the public Provision* methods exists to
	// coordinate with running()'s dashboard-polling loop, which has not started
	// yet at this point; callers here invoke the underlying provisioners
	// directly so parallel phases do not serialize on that mutex.
	g, gctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		appPath := filepath.Join(ps.Cfg.ProvisioningPath, "plugins")
		if err := ps.provisionPlugins(gctx, appPath, ps.pluginStore, ps.pluginsSettings, ps.orgService); err != nil {
			ps.log.Error("Failed to provision plugins", "error", err)
			return fmt.Errorf("%v: %w", "app provisioning error", err)
		}
		return nil
	})

	g.Go(func() error {
		datasourcePath := filepath.Join(ps.Cfg.ProvisioningPath, "datasources")
		if err := ps.provisionDatasources(gctx, datasourcePath, ps.datasourceService, ps.correlationsService, ps.orgService); err != nil {
			ps.log.Error("Failed to provision data sources", "error", err)
			return fmt.Errorf("%v: %w", "Datasource provisioning error", err)
		}

		// Phase 2: alerting, dashboards, and the Prometheus-type migration all
		// require datasources but are independent of each other.
		phase2, p2ctx := errgroup.WithContext(gctx)

		phase2.Go(func() error {
			if err := ps.ProvisionAlerting(p2ctx); err != nil {
				ps.log.Error("Failed to provision alerting", "error", err)
				return err
			}
			return nil
		})

		phase2.Go(func() error {
			if err := ps.migratePrometheusType(p2ctx); err != nil {
				ps.log.Error("Failed to migrate Prometheus type", "error", err)
				return err
			}
			return nil
		})

		phase2.Go(func() error {
			if err := ps.provisionDashboardsStarting(p2ctx); err != nil {
				ps.log.Error("Failed to provision dashboard", "error", err)
				// Allow-list: only dashboards.ErrGetOrCreateFolder is tolerated.
				if !errors.Is(err, dashboards.ErrGetOrCreateFolder) {
					return err
				}
			}
			return nil
		})

		return phase2.Wait()
	})

	return g.Wait()
}

// provisionDashboardsStarting mirrors ProvisionDashboards but omits the
// per-service mutex so it can run in parallel with other startup phases.
// Safe during starting() because running()'s polling loop has not begun.
func (ps *ProvisioningServiceImpl) provisionDashboardsStarting(ctx context.Context) error {
	if err := ps.setDashboardProvisioner(); err != nil {
		return fmt.Errorf("%v: %w", "Failed to create provisioner", err)
	}
	ps.cancelPolling()
	ps.dashboardProvisioner.CleanUpOrphanedDashboards(ctx)
	if err := ps.dashboardProvisioner.Provision(ctx); err != nil {
		return fmt.Errorf("%v: %w", "Failed to provision dashboards", err)
	}
	return nil
}

func (ps *ProvisioningServiceImpl) running(ctx context.Context) error {
	for {
		// Wait for unlock. This is tied to new dashboardProvisioner to be instantiated before we start polling.
		ps.mutex.Lock()
		// Using background here because otherwise if root context was canceled the select later on would
		// non-deterministically take one of the route possibly going into one polling loop before exiting.
		pollingContext, cancelFun := context.WithCancel(context.Background())
		ps.pollingCtxCancel = cancelFun
		ps.dashboardProvisioner.PollChanges(pollingContext)
		ps.mutex.Unlock()

		select {
		case <-pollingContext.Done():
			// Polling was canceled.
			continue
		case <-ctx.Done():
			// Root server context was cancelled so cancel polling and leave.
			ps.cancelPolling()
			return nil
		}
	}
}

func (ps *ProvisioningServiceImpl) setDashboardProvisioner() error {
	dashboardPath := filepath.Join(ps.Cfg.ProvisioningPath, "dashboards")
	dashProvisioner, err := ps.newDashboardProvisioner(context.Background(), dashboardPath, ps.dashboardProvisioningService, ps.Cfg, ps.orgService, ps.dashboardService, ps.folderService, ps.dual, ps.serverLock)
	if err != nil {
		return fmt.Errorf("%v: %w", "Failed to create provisioner", err)
	}
	ps.dashboardProvisioner = dashProvisioner
	return nil
}

type ProvisioningService interface {
	registry.BackgroundService
	RunInitProvisioners(ctx context.Context) error
	ProvisionDatasources(ctx context.Context) error
	ProvisionPlugins(ctx context.Context) error
	ProvisionDashboards(ctx context.Context) error
	ProvisionAlerting(ctx context.Context) error
	GetDashboardProvisionerResolvedPath(name string) string
	GetAllowUIUpdatesFromConfig(name string) bool
}

// Used for testing purposes
func newProvisioningServiceImpl(
	newDashboardProvisioner dashboards.DashboardProvisionerFactory,
	provisionDatasources func(context.Context, string, datasources.BaseDataSourceService, datasources.CorrelationsStore, org.Service) error,
	provisionPlugins func(context.Context, string, pluginstore.Store, pluginsettings.Service, org.Service) error,
	migratePrometheusType func(context.Context) error,
) (*ProvisioningServiceImpl, error) {
	s := &ProvisioningServiceImpl{
		log:                     log.New("provisioning"),
		newDashboardProvisioner: newDashboardProvisioner,
		provisionDatasources:    provisionDatasources,
		provisionPlugins:        provisionPlugins,
		Cfg:                     setting.NewCfg(),
		migratePrometheusType:   migratePrometheusType,
	}

	s.NamedService = services.NewBasicService(s.starting, s.running, nil).WithName(ServiceName)

	if err := s.setDashboardProvisioner(); err != nil {
		return nil, err
	}

	return s, nil
}

type ProvisioningServiceImpl struct {
	services.NamedService
	Cfg                          *setting.Cfg
	SQLStore                     db.DB
	orgService                   org.Service
	userService                  user.Service
	ac                           accesscontrol.AccessControl
	pluginStore                  pluginstore.Store
	alertingStore                *alertstore.DBstore
	EncryptionService            encryption.Internal
	NotificationService          *notifications.NotificationService
	log                          log.Logger
	pollingCtxCancel             context.CancelFunc
	newDashboardProvisioner      dashboards.DashboardProvisionerFactory
	dashboardProvisioner         dashboards.DashboardProvisioner
	provisionDatasources         func(context.Context, string, datasources.BaseDataSourceService, datasources.CorrelationsStore, org.Service) error
	provisionPlugins             func(context.Context, string, pluginstore.Store, pluginsettings.Service, org.Service) error
	provisionAlerting            func(context.Context, prov_alerting.ProvisionerConfig) error
	mutex                        sync.Mutex
	dashboardProvisioningService dashboardservice.DashboardProvisioningService
	dashboardService             dashboardservice.DashboardService
	datasourceService            datasourceservice.DataSourceService
	correlationsService          correlations.Service
	pluginsSettings              pluginsettings.Service
	quotaService                 quota.Service
	secretService                secrets.Service
	folderService                folder.Service
	resourcePermissions          accesscontrol.ReceiverPermissionsService
	routesPermissions            accesscontrol.RoutePermissionsService
	tracer                       tracing.Tracer
	dual                         dualwrite.Service
	serverLock                   *serverlock.ServerLockService
	migratePrometheusType        func(context.Context) error
}

func (ps *ProvisioningServiceImpl) RunInitProvisioners(ctx context.Context) error {
	// We had to move the initialization of OSS provisioners to Run()
	// because they need the /apis/* endpoints to be ready and listening.
	// They query these endpoints to retrieve folders and dashboards.
	return nil
}

func (ps *ProvisioningServiceImpl) Run(ctx context.Context) error {
	if err := ps.StartAsync(ctx); err != nil {
		return err
	}
	stopCtx := context.Background()
	return ps.AwaitTerminated(stopCtx)
}

func (ps *ProvisioningServiceImpl) ProvisionDatasources(ctx context.Context) error {
	ps.mutex.Lock()
	defer ps.mutex.Unlock()
	datasourcePath := filepath.Join(ps.Cfg.ProvisioningPath, "datasources")
	if err := ps.provisionDatasources(ctx, datasourcePath, ps.datasourceService, ps.correlationsService, ps.orgService); err != nil {
		err = fmt.Errorf("%v: %w", "Datasource provisioning error", err)
		ps.log.Error("Failed to provision data sources", "error", err)
		return err
	}
	return nil
}

func (ps *ProvisioningServiceImpl) ProvisionPlugins(ctx context.Context) error {
	ps.mutex.Lock()
	defer ps.mutex.Unlock()
	appPath := filepath.Join(ps.Cfg.ProvisioningPath, "plugins")
	if err := ps.provisionPlugins(ctx, appPath, ps.pluginStore, ps.pluginsSettings, ps.orgService); err != nil {
		err = fmt.Errorf("%v: %w", "app provisioning error", err)
		ps.log.Error("Failed to provision plugins", "error", err)
		return err
	}
	return nil
}

func (ps *ProvisioningServiceImpl) ProvisionDashboards(ctx context.Context) error {
	err := ps.setDashboardProvisioner()
	if err != nil {
		return fmt.Errorf("%v: %w", "Failed to create provisioner", err)
	}

	ps.mutex.Lock()
	defer ps.mutex.Unlock()

	ps.cancelPolling()
	ps.dashboardProvisioner.CleanUpOrphanedDashboards(ctx)

	err = ps.dashboardProvisioner.Provision(ctx)
	if err != nil {
		// If we fail to provision with the new provisioner, the mutex will unlock and the polling will restart with the
		// old provisioner as we did not switch them yet.
		return fmt.Errorf("%v: %w", "Failed to provision dashboards", err)
	}
	return nil
}

func (ps *ProvisioningServiceImpl) ProvisionAlerting(ctx context.Context) error {
	alertingPath := filepath.Join(ps.Cfg.ProvisioningPath, "alerting")
	ruleService := provisioning.NewAlertRuleService(
		ps.alertingStore,
		ps.alertingStore,
		ps.folderService,
		// ps.dashboardService,
		ps.quotaService,
		ps.SQLStore,
		int64(ps.Cfg.UnifiedAlerting.DefaultRuleEvaluationInterval.Seconds()),
		int64(ps.Cfg.UnifiedAlerting.BaseInterval.Seconds()),
		ps.Cfg.UnifiedAlerting.RulesPerRuleGroupLimit,
		ps.log,
		notifier.NewCachedNotificationSettingsValidationService(ps.alertingStore),
		alertingauthz.NewRuleService(ps.ac),
	)
	var features featuremgmt.FeatureToggles
	if ps.alertingStore != nil {
		features = ps.alertingStore.FeatureToggles
	}
	configStore := legacy_storage.NewAlertmanagerConfigStore(ps.alertingStore, notifier.NewExtraConfigsCrypto(ps.secretService), features)
	routeService := routes.NewService(
		configStore,
		ps.alertingStore,
		ps.alertingStore,
		ps.Cfg.UnifiedAlerting,
		features,
		ps.log,
		validation.ValidateProvenanceRelaxed,
		ps.tracer,
		alertingauthz.NewRouteAccess[*legacy_storage.ManagedRoute](ps.ac, ps.routesPermissions, true),
	)
	receiverAuthz := alertingauthz.NewReceiverAccess[*ngmodels.Receiver](ps.ac, true)
	emailValidator := notifier.NewEmailValidator(ps.orgService, ps.Cfg.UnifiedAlerting.LimitEmailToOrgMembers)
	receiverSvc := notifier.NewReceiverService(
		receiverAuthz,
		configStore,
		ps.alertingStore,
		ps.alertingStore,
		routeService,
		ps.secretService,
		ps.SQLStore,
		ps.log,
		ps.resourcePermissions,
		ps.tracer,
		validation.ValidateProvenanceRelaxed,
		false,
		ps.Cfg.UnifiedAlerting.AllowedIntegrations,
		emailValidator,
	)
	contactPointService := provisioning.NewContactPointService(receiverAuthz, configStore, ps.secretService,
		ps.alertingStore, ps.SQLStore, receiverSvc, ps.log, ps.alertingStore, ps.resourcePermissions, ps.Cfg.UnifiedAlerting.AllowedIntegrations, emailValidator)
	notificationPolicyService := provisioning.NewNotificationPolicyService(configStore,
		ps.alertingStore, ps.SQLStore, routeService, ps.Cfg.UnifiedAlerting, ps.log, validation.ValidateProvenanceRelaxed)
	mutetimingsService := provisioning.NewMuteTimingService(configStore, ps.alertingStore, ps.alertingStore, ps.log, ps.alertingStore, routeService, validation.ValidateProvenanceRelaxed)
	templateService := provisioning.NewTemplateService(configStore, ps.alertingStore, ps.alertingStore, ps.log, validation.ValidateProvenanceRelaxed)
	cfg := prov_alerting.ProvisionerConfig{
		Path:                       alertingPath,
		RuleService:                *ruleService,
		FolderService:              ps.folderService,
		DashboardProvService:       ps.dashboardProvisioningService,
		ContactPointService:        *contactPointService,
		NotificiationPolicyService: *notificationPolicyService,
		MuteTimingService:          *mutetimingsService,
		TemplateService:            *templateService,
	}
	return ps.provisionAlerting(ctx, cfg)
}

func (ps *ProvisioningServiceImpl) GetDashboardProvisionerResolvedPath(name string) string {
	return ps.dashboardProvisioner.GetProvisionerResolvedPath(name)
}

func (ps *ProvisioningServiceImpl) GetAllowUIUpdatesFromConfig(name string) bool {
	return ps.dashboardProvisioner.GetAllowUIUpdatesFromConfig(name)
}

func (ps *ProvisioningServiceImpl) cancelPolling() {
	if ps.pollingCtxCancel != nil {
		ps.log.Debug("Stop polling for dashboard changes")
		ps.pollingCtxCancel()
	}
	ps.pollingCtxCancel = nil
}
