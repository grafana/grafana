package provisioning

import (
	"context"
	"path/filepath"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	plugifaces "github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/encryption"
	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning/datasources"
	"github.com/grafana/grafana/pkg/services/provisioning/notifiers"
	"github.com/grafana/grafana/pkg/services/provisioning/plugins"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func ProvideService(cfg *setting.Cfg, sqlStore *sqlstore.SQLStore, pluginStore plugifaces.Store,
	encryptionService encryption.Internal) (*ProvisioningServiceImpl, error) {
	s := &ProvisioningServiceImpl{
		Cfg:                     cfg,
		SQLStore:                sqlStore,
		pluginStore:             pluginStore,
		EncryptionService:       encryptionService,
		log:                     log.New("provisioning"),
		newDashboardProvisioner: dashboards.New,
		provisionNotifiers:      notifiers.Provision,
		provisionDatasources:    datasources.Provision,
		provisionPlugins:        plugins.Provision,
	}
	return s, nil
}

type ProvisioningService interface {
	registry.BackgroundService
	RunInitProvisioners(ctx context.Context) error
	ProvisionDatasources(ctx context.Context) error
	ProvisionPlugins() error
	ProvisionNotifications(ctx context.Context) error
	ProvisionDashboards(ctx context.Context) error
	GetDashboardProvisionerResolvedPath(name string) string
	GetAllowUIUpdatesFromConfig(name string) bool
}

// Add a public constructor for overriding service to be able to instantiate OSS as fallback
func NewProvisioningServiceImpl() *ProvisioningServiceImpl {
	return &ProvisioningServiceImpl{
		log:                     log.New("provisioning"),
		newDashboardProvisioner: dashboards.New,
		provisionNotifiers:      notifiers.Provision,
		provisionDatasources:    datasources.Provision,
		provisionPlugins:        plugins.Provision,
	}
}

// Used for testing purposes
func newProvisioningServiceImpl(
	newDashboardProvisioner dashboards.DashboardProvisionerFactory,
	provisionNotifiers func(context.Context, string, encryption.Internal) error,
	provisionDatasources func(context.Context, string) error,
	provisionPlugins func(string, plugifaces.Store) error,
) *ProvisioningServiceImpl {
	return &ProvisioningServiceImpl{
		log:                     log.New("provisioning"),
		newDashboardProvisioner: newDashboardProvisioner,
		provisionNotifiers:      provisionNotifiers,
		provisionDatasources:    provisionDatasources,
		provisionPlugins:        provisionPlugins,
	}
}

type ProvisioningServiceImpl struct {
	Cfg                     *setting.Cfg
	SQLStore                *sqlstore.SQLStore
	pluginStore             plugifaces.Store
	EncryptionService       encryption.Internal
	log                     log.Logger
	pollingCtxCancel        context.CancelFunc
	newDashboardProvisioner dashboards.DashboardProvisionerFactory
	dashboardProvisioner    dashboards.DashboardProvisioner
	provisionNotifiers      func(context.Context, string, encryption.Internal) error
	provisionDatasources    func(context.Context, string) error
	provisionPlugins        func(string, plugifaces.Store) error
	mutex                   sync.Mutex
}

func (ps *ProvisioningServiceImpl) RunInitProvisioners(ctx context.Context) error {
	err := ps.ProvisionDatasources(ctx)
	if err != nil {
		return err
	}

	err = ps.ProvisionPlugins()
	if err != nil {
		return err
	}

	err = ps.ProvisionNotifications(ctx)
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
	err := ps.provisionDatasources(ctx, datasourcePath)
	return errutil.Wrap("Datasource provisioning error", err)
}

func (ps *ProvisioningServiceImpl) ProvisionPlugins() error {
	appPath := filepath.Join(ps.Cfg.ProvisioningPath, "plugins")
	err := ps.provisionPlugins(appPath, ps.pluginStore)
	return errutil.Wrap("app provisioning error", err)
}

func (ps *ProvisioningServiceImpl) ProvisionNotifications(ctx context.Context) error {
	alertNotificationsPath := filepath.Join(ps.Cfg.ProvisioningPath, "notifiers")
	err := ps.provisionNotifiers(ctx, alertNotificationsPath, ps.EncryptionService)
	return errutil.Wrap("Alert notification provisioning error", err)
}

func (ps *ProvisioningServiceImpl) ProvisionDashboards(ctx context.Context) error {
	dashboardPath := filepath.Join(ps.Cfg.ProvisioningPath, "dashboards")
	dashProvisioner, err := ps.newDashboardProvisioner(ctx, dashboardPath, ps.SQLStore)
	if err != nil {
		return errutil.Wrap("Failed to create provisioner", err)
	}

	ps.mutex.Lock()
	defer ps.mutex.Unlock()

	ps.cancelPolling()
	dashProvisioner.CleanUpOrphanedDashboards(ctx)

	err = dashProvisioner.Provision(ctx)
	if err != nil {
		// If we fail to provision with the new provisioner, the mutex will unlock and the polling will restart with the
		// old provisioner as we did not switch them yet.
		return errutil.Wrap("Failed to provision dashboards", err)
	}
	ps.dashboardProvisioner = dashProvisioner
	return nil
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
