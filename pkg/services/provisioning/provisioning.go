package provisioning

import (
	"context"
	"fmt"
	"path/filepath"
	"sync"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/modules"
	plugifaces "github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/alerting"
	"github.com/grafana/grafana/pkg/services/correlations"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards"
	datasourceservice "github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	prov_alerting "github.com/grafana/grafana/pkg/services/provisioning/alerting"
	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning/datasources"
	"github.com/grafana/grafana/pkg/services/provisioning/notifiers"
	"github.com/grafana/grafana/pkg/services/provisioning/plugins"
	"github.com/grafana/grafana/pkg/services/quota"
	"github.com/grafana/grafana/pkg/services/searchV2"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/setting"
)

func ProvideService(
	ac accesscontrol.AccessControl,
	cfg *setting.Cfg,
	sqlStore db.DB,
	pluginStore plugifaces.Store,
	encryptionService encryption.Internal,
	notificatonService *notifications.NotificationService,
	dashboardProvisioningService dashboardservice.DashboardProvisioningService,
	datasourceService datasourceservice.DataSourceService,
	correlationsService correlations.Service,
	dashboardService dashboardservice.DashboardService,
	folderService folder.Service,
	alertingService *alerting.AlertNotificationService,
	pluginSettings pluginsettings.Service,
	searchService searchV2.SearchService,
	quotaService quota.Service,
	secrectService secrets.Service,
	orgService org.Service,
) (*ProvisioningServiceImpl, error) {
	ps := &ProvisioningServiceImpl{
		Cfg:                          cfg,
		SQLStore:                     sqlStore,
		ac:                           ac,
		pluginStore:                  pluginStore,
		EncryptionService:            encryptionService,
		NotificationService:          notificatonService,
		newDashboardProvisioner:      dashboards.New,
		provisionNotifiers:           notifiers.Provision,
		provisionDatasources:         datasources.Provision,
		provisionPlugins:             plugins.Provision,
		provisionAlerting:            prov_alerting.Provision,
		dashboardProvisioningService: dashboardProvisioningService,
		dashboardService:             dashboardService,
		datasourceService:            datasourceService,
		correlationsService:          correlationsService,
		alertingService:              alertingService,
		pluginsSettings:              pluginSettings,
		searchService:                searchService,
		quotaService:                 quotaService,
		secretService:                secrectService,
		log:                          log.New("provisioning"),
		orgService:                   orgService,
	}

	ps.BasicService = services.NewBasicService(ps.RunInitProvisioners, ps.Run, nil).WithName(modules.Provisioning)

	return ps, nil
}

type ProvisioningService interface {
	services.NamedService
	ProvisionDatasources(ctx context.Context) error
	ProvisionPlugins(ctx context.Context) error
	ProvisionNotifications(ctx context.Context) error
	ProvisionDashboards(ctx context.Context) error
	ProvisionAlerting(ctx context.Context) error
	GetDashboardProvisionerResolvedPath(name string) string
	GetAllowUIUpdatesFromConfig(name string) bool
}

// Add a public constructor for overriding service to be able to instantiate OSS as fallback
func NewProvisioningServiceImpl() *ProvisioningServiceImpl {
	logger := log.New("provisioning")
	ps := &ProvisioningServiceImpl{
		log:                     logger,
		newDashboardProvisioner: dashboards.New,
		provisionNotifiers:      notifiers.Provision,
		provisionDatasources:    datasources.Provision,
		provisionPlugins:        plugins.Provision,
	}
	ps.BasicService = services.NewBasicService(ps.RunInitProvisioners, ps.Run, nil).WithName(modules.Provisioning)
	return ps
}

// Used for testing purposes
func newProvisioningServiceImpl(
	newDashboardProvisioner dashboards.DashboardProvisionerFactory,
	provisionNotifiers func(context.Context, string, notifiers.Manager, org.Service, encryption.Internal, *notifications.NotificationService) error,
	provisionDatasources func(context.Context, string, datasources.Store, datasources.CorrelationsStore, org.Service) error,
	provisionPlugins func(context.Context, string, plugifaces.Store, pluginsettings.Service, org.Service) error,
) *ProvisioningServiceImpl {
	ps := &ProvisioningServiceImpl{
		log:                     log.New("provisioning"),
		newDashboardProvisioner: newDashboardProvisioner,
		provisionNotifiers:      provisionNotifiers,
		provisionDatasources:    provisionDatasources,
		provisionPlugins:        provisionPlugins,
	}
	ps.BasicService = services.NewBasicService(ps.RunInitProvisioners, ps.Run, nil).WithName(modules.Provisioning)
	return ps
}

type ProvisioningServiceImpl struct {
	*services.BasicService

	Cfg                          *setting.Cfg
	SQLStore                     db.DB
	orgService                   org.Service
	ac                           accesscontrol.AccessControl
	pluginStore                  plugifaces.Store
	EncryptionService            encryption.Internal
	NotificationService          *notifications.NotificationService
	log                          log.Logger
	pollingCtxCancel             context.CancelFunc
	newDashboardProvisioner      dashboards.DashboardProvisionerFactory
	dashboardProvisioner         dashboards.DashboardProvisioner
	provisionNotifiers           func(context.Context, string, notifiers.Manager, org.Service, encryption.Internal, *notifications.NotificationService) error
	provisionDatasources         func(context.Context, string, datasources.Store, datasources.CorrelationsStore, org.Service) error
	provisionPlugins             func(context.Context, string, plugifaces.Store, pluginsettings.Service, org.Service) error
	provisionAlerting            func(context.Context, prov_alerting.ProvisionerConfig) error
	mutex                        sync.Mutex
	dashboardProvisioningService dashboardservice.DashboardProvisioningService
	dashboardService             dashboardservice.DashboardService
	datasourceService            datasourceservice.DataSourceService
	correlationsService          correlations.Service
	alertingService              *alerting.AlertNotificationService
	pluginsSettings              pluginsettings.Service
	searchService                searchV2.SearchService
	quotaService                 quota.Service
	secretService                secrets.Service
}

func (ps *ProvisioningServiceImpl) RunInitProvisioners(ctx context.Context) error {
	err := ps.ProvisionDatasources(ctx)
	if err != nil {
		return err
	}

	err = ps.ProvisionPlugins(ctx)
	if err != nil {
		return err
	}

	err = ps.ProvisionNotifications(ctx)
	if err != nil {
		return err
	}

	err = ps.ProvisionAlerting(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (ps *ProvisioningServiceImpl) Run(ctx context.Context) error {
	err := ps.ProvisionDashboards(ctx)
	if err != nil {
		ps.log.Error("Failed to provision dashboard", "error", err)
		return err
	}
	if ps.dashboardProvisioner.HasDashboardSources() {
		ps.searchService.TriggerReIndex()
	}

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

func (ps *ProvisioningServiceImpl) ProvisionDatasources(ctx context.Context) error {
	datasourcePath := filepath.Join(ps.Cfg.ProvisioningPath, "datasources")
	if err := ps.provisionDatasources(ctx, datasourcePath, ps.datasourceService, ps.correlationsService, ps.orgService); err != nil {
		err = fmt.Errorf("%v: %w", "Datasource provisioning error", err)
		ps.log.Error("Failed to provision data sources", "error", err)
		return err
	}
	return nil
}

func (ps *ProvisioningServiceImpl) ProvisionPlugins(ctx context.Context) error {
	appPath := filepath.Join(ps.Cfg.ProvisioningPath, "plugins")
	if err := ps.provisionPlugins(ctx, appPath, ps.pluginStore, ps.pluginsSettings, ps.orgService); err != nil {
		err = fmt.Errorf("%v: %w", "app provisioning error", err)
		ps.log.Error("Failed to provision plugins", "error", err)
		return err
	}
	return nil
}

func (ps *ProvisioningServiceImpl) ProvisionNotifications(ctx context.Context) error {
	alertNotificationsPath := filepath.Join(ps.Cfg.ProvisioningPath, "notifiers")
	if err := ps.provisionNotifiers(ctx, alertNotificationsPath, ps.alertingService, ps.orgService, ps.EncryptionService, ps.NotificationService); err != nil {
		err = fmt.Errorf("%v: %w", "Alert notification provisioning error", err)
		ps.log.Error("Failed to provision alert notifications", "error", err)
		return err
	}
	return nil
}

func (ps *ProvisioningServiceImpl) ProvisionDashboards(ctx context.Context) error {
	dashboardPath := filepath.Join(ps.Cfg.ProvisioningPath, "dashboards")
	dashProvisioner, err := ps.newDashboardProvisioner(ctx, dashboardPath, ps.dashboardProvisioningService, ps.orgService, ps.dashboardService)
	if err != nil {
		return fmt.Errorf("%v: %w", "Failed to create provisioner", err)
	}

	ps.mutex.Lock()
	defer ps.mutex.Unlock()

	ps.cancelPolling()
	dashProvisioner.CleanUpOrphanedDashboards(ctx)

	err = dashProvisioner.Provision(ctx)
	if err != nil {
		// If we fail to provision with the new provisioner, the mutex will unlock and the polling will restart with the
		// old provisioner as we did not switch them yet.
		return fmt.Errorf("%v: %w", "Failed to provision dashboards", err)
	}
	ps.dashboardProvisioner = dashProvisioner
	return nil
}

func (ps *ProvisioningServiceImpl) ProvisionAlerting(ctx context.Context) error {
	alertingPath := filepath.Join(ps.Cfg.ProvisioningPath, "alerting")
	st := store.DBstore{
		Cfg:              ps.Cfg.UnifiedAlerting,
		SQLStore:         ps.SQLStore,
		Logger:           ps.log,
		FolderService:    nil, // we don't use it yet
		AccessControl:    ps.ac,
		DashboardService: ps.dashboardService,
	}
	ruleService := provisioning.NewAlertRuleService(
		st,
		st,
		ps.dashboardService,
		ps.quotaService,
		ps.SQLStore,
		int64(ps.Cfg.UnifiedAlerting.DefaultRuleEvaluationInterval.Seconds()),
		int64(ps.Cfg.UnifiedAlerting.BaseInterval.Seconds()),
		ps.log)
	contactPointService := provisioning.NewContactPointService(&st, ps.secretService,
		st, ps.SQLStore, ps.log)
	notificationPolicyService := provisioning.NewNotificationPolicyService(&st,
		st, ps.SQLStore, ps.Cfg.UnifiedAlerting, ps.log)
	mutetimingsService := provisioning.NewMuteTimingService(&st, st, &st, ps.log)
	templateService := provisioning.NewTemplateService(&st, st, &st, ps.log)
	cfg := prov_alerting.ProvisionerConfig{
		Path:                       alertingPath,
		RuleService:                *ruleService,
		DashboardService:           ps.dashboardService,
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
