package provisioning

import (
	"context"
	"github.com/grafana/grafana/pkg/log"
	"github.com/pkg/errors"
	"path"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning/datasources"
	"github.com/grafana/grafana/pkg/services/provisioning/notifiers"
	"github.com/grafana/grafana/pkg/setting"
)

func init() {
	registry.RegisterService(NewProvisioningServiceImpl(
		func(path string) (dashboards.DashboardProvisioner, error) {
			return dashboards.NewDashboardProvisionerImpl(path)
		},
		notifiers.Provision,
		datasources.Provision,
	))
}

type ProvisioningService interface {
	ProvisionDatasources() error
	ProvisionNotifications() error
	ProvisionDashboards() error
}

func NewProvisioningServiceImpl(
	newDashboardProvisioner func(string) (dashboards.DashboardProvisioner, error),
	provisionNotifiers func(string) error,
	provisionDatasources func(string) error,
) *provisioningServiceImpl {
	return &provisioningServiceImpl{
		log:                     log.New("provisioning"),
		newDashboardProvisioner: newDashboardProvisioner,
		provisionNotifiers:      provisionNotifiers,
		provisionDatasources:    provisionDatasources,
		// Channel to send new provisioner and start polling with it. Needs to have 1 buffering to allow creating the
		// the provisioner in Init and let the polling start later in Run().
		dashProvisionerChan: make(chan dashboards.DashboardProvisioner, 1),
	}
}

type provisioningServiceImpl struct {
	Cfg                     *setting.Cfg `inject:""`
	log                     log.Logger
	dashProvisionerChan     chan dashboards.DashboardProvisioner
	pollingCtxCancel        context.CancelFunc
	newDashboardProvisioner func(string) (dashboards.DashboardProvisioner, error)
	provisionNotifiers      func(string) error
	provisionDatasources    func(string) error
}

func (ps *provisioningServiceImpl) Init() error {
	err := ps.ProvisionDatasources()
	if err != nil {
		return err
	}

	err = ps.ProvisionNotifications()
	if err != nil {
		return err
	}

	err = ps.ProvisionDashboards()
	if err != nil {
		return err
	}

	return nil
}

func (ps *provisioningServiceImpl) Run(ctx context.Context) error {
	for {
		// We do not have to check for cancellation of the pollingContext in the select statement as there is
		// nothing to do with that, just wait for new provisioner to start polling again.
		select {
		case provisioner := <-ps.dashProvisionerChan:
			// There is new dashboard provisioner config so we need to start polling for it.
			// Make sure the old polling process is cancelled even though this should be called before by the code
			// creating new provisioner to prevent race conditions.
			ps.cancelPolling()

			pollingContext, cancelFun := context.WithCancel(ctx)
			ps.pollingCtxCancel = cancelFun

			provisioner.PollChanges(pollingContext)
		case <-ctx.Done():
			// Root server context was cancelled so just leave.
			return ctx.Err()
		}
	}
}

func (ps *provisioningServiceImpl) ProvisionDatasources() error {
	datasourcePath := path.Join(ps.Cfg.ProvisioningPath, "datasources")
	err := ps.provisionDatasources(datasourcePath)
	return errors.Wrap(err, "Datasource provisioning error")
}

func (ps *provisioningServiceImpl) ProvisionNotifications() error {
	alertNotificationsPath := path.Join(ps.Cfg.ProvisioningPath, "notifiers")
	err := ps.provisionNotifiers(alertNotificationsPath)
	return errors.Wrap(err, "Alert notification provisioning error")
}

func (ps *provisioningServiceImpl) ProvisionDashboards() error {
	dashboardPath := path.Join(ps.Cfg.ProvisioningPath, "dashboards")
	dashProvisioner, err := ps.newDashboardProvisioner(dashboardPath)
	if err != nil {
		return errors.Wrap(err, "Failed to create provisioner")
	}
	// Lets cancel first so we do not get new config temporary overwritten by the polling process.
	ps.cancelPolling()

	if err := dashProvisioner.Provision(); err != nil {
		return errors.Wrap(err, "Failed to provision dashboards")
	}
	ps.dashProvisionerChan <- dashProvisioner
	return nil
}

func (ps *provisioningServiceImpl) cancelPolling() {
	if ps.pollingCtxCancel != nil {
		ps.log.Debug("Stop polling for dashboard changes")
		ps.pollingCtxCancel()
	}
	ps.pollingCtxCancel = nil
}
