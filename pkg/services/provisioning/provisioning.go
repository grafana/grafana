package provisioning

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"sync"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/correlations"
	dashboardservice "github.com/grafana/grafana/pkg/services/dashboards"
	datasourceservice "github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/folder"
	alertingauthz "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	prov_alerting "github.com/grafana/grafana/pkg/services/provisioning/alerting"
	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning/datasources"
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
	pluginStore pluginstore.Store,
	encryptionService encryption.Internal,
	notificatonService *notifications.NotificationService,
	dashboardProvisioningService dashboardservice.DashboardProvisioningService,
	datasourceService datasourceservice.DataSourceService,
	correlationsService correlations.Service,
	dashboardService dashboardservice.DashboardService,
	folderService folder.Service,
	pluginSettings pluginsettings.Service,
	searchService searchV2.SearchService,
	quotaService quota.Service,
	secrectService secrets.Service,
	orgService org.Service,
) (*ProvisioningServiceImpl, error) {
	s := &ProvisioningServiceImpl{
		Cfg:                          cfg,
		SQLStore:                     sqlStore,
		ac:                           ac,
		pluginStore:                  pluginStore,
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
		searchService:                searchService,
		quotaService:                 quotaService,
		secretService:                secrectService,
		log:                          log.New("provisioning"),
		orgService:                   orgService,
		folderService:                folderService,
	}

	if err := s.setDashboardProvisioner(); err != nil {
		return nil, err
	}

	return s, nil
}

func (ps *ProvisioningServiceImpl) setDashboardProvisioner() error {
	dashboardPath := filepath.Join(ps.Cfg.ProvisioningPath, "dashboards")
	dashProvisioner, err := ps.newDashboardProvisioner(context.Background(), dashboardPath, ps.dashboardProvisioningService, ps.orgService, ps.dashboardService, ps.folderService)
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
	searchService searchV2.SearchService,
) (*ProvisioningServiceImpl, error) {
	s := &ProvisioningServiceImpl{
		log:                     log.New("provisioning"),
		newDashboardProvisioner: newDashboardProvisioner,
		provisionDatasources:    provisionDatasources,
		provisionPlugins:        provisionPlugins,
		Cfg:                     setting.NewCfg(),
		searchService:           searchService,
	}

	if err := s.setDashboardProvisioner(); err != nil {
		return nil, err
	}

	return s, nil
}

type ProvisioningServiceImpl struct {
	Cfg                          *setting.Cfg
	SQLStore                     db.DB
	orgService                   org.Service
	ac                           accesscontrol.AccessControl
	pluginStore                  pluginstore.Store
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
	searchService                searchV2.SearchService
	quotaService                 quota.Service
	secretService                secrets.Service
	folderService                folder.Service
}

func (ps *ProvisioningServiceImpl) RunInitProvisioners(ctx context.Context) error {
	err := ps.ProvisionDatasources(ctx)
	if err != nil {
		ps.log.Error("Failed to provision data sources", "error", err)
		return err
	}

	err = ps.ProvisionPlugins(ctx)
	if err != nil {
		ps.log.Error("Failed to provision plugins", "error", err)
		return err
	}

	err = ps.ProvisionAlerting(ctx)
	if err != nil {
		ps.log.Error("Failed to provision alerting", "error", err)
		return err
	}

	return nil
}

func (ps *ProvisioningServiceImpl) Run(ctx context.Context) error {
	err := ps.ProvisionDashboards(ctx)
	if err != nil {
		ps.log.Error("Failed to provision dashboard", "error", err)
		// Consider the allow list of errors for which running the provisioning service should not
		// fail. For now this includes only dashboards.ErrGetOrCreateFolder.
		if !errors.Is(err, dashboards.ErrGetOrCreateFolder) {
			return err
		}
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
			return ctx.Err()
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
	st := store.DBstore{
		Cfg:              ps.Cfg.UnifiedAlerting,
		SQLStore:         ps.SQLStore,
		Logger:           ps.log,
		FolderService:    nil, // we don't use it yet
		DashboardService: ps.dashboardService,
	}
	ruleService := provisioning.NewAlertRuleService(
		st,
		st,
		ps.folderService,
		//ps.dashboardService,
		ps.quotaService,
		ps.SQLStore,
		int64(ps.Cfg.UnifiedAlerting.DefaultRuleEvaluationInterval.Seconds()),
		int64(ps.Cfg.UnifiedAlerting.BaseInterval.Seconds()),
		ps.Cfg.UnifiedAlerting.RulesPerRuleGroupLimit,
		ps.log,
		notifier.NewCachedNotificationSettingsValidationService(&st),
		alertingauthz.NewRuleService(ps.ac),
	)
	configStore := legacy_storage.NewAlertmanagerConfigStore(&st)
	receiverSvc := notifier.NewReceiverService(
		alertingauthz.NewReceiverAccess[*ngmodels.Receiver](ps.ac, true),
		configStore,
		st,
		st,
		ps.secretService,
		ps.SQLStore,
		ps.log,
	)
	contactPointService := provisioning.NewContactPointService(configStore, ps.secretService,
		st, ps.SQLStore, receiverSvc, ps.log, &st)
	notificationPolicyService := provisioning.NewNotificationPolicyService(configStore,
		st, ps.SQLStore, ps.Cfg.UnifiedAlerting, ps.log)
	mutetimingsService := provisioning.NewMuteTimingService(configStore, st, &st, ps.log, &st)
	templateService := provisioning.NewTemplateService(configStore, st, &st, ps.log)
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
