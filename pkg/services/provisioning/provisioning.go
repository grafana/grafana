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
	registry.RegisterService(&ProvisioningService{})
}

type ProvisioningService struct {
	Cfg                 *setting.Cfg `inject:""`
	log                 log.Logger
	dashProvisionerChan chan *dashboards.DashboardProvisioner
	pollingCtxCancel    context.CancelFunc
}

func (ps *ProvisioningService) Init() error {
	ps.log = log.New("provisioning")
	// Channel to send new provisioner and start polling with it. Needs to have 1 buffering to allow creating the
	// the provisioner here in init and let the polling start later in Run().
	ps.dashProvisionerChan = make(chan *dashboards.DashboardProvisioner, 1)

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

func (ps *ProvisioningService) Run(ctx context.Context) error {
	for {
		// We do not have to check for cancellation of the pollingContext in the select statement as there is
		// nothing to do with that, just wait for new provisioner to start polling again.
		select {
		case provisioner := <-ps.dashProvisionerChan:
			// There is new dashboard provisioner config so we need to start polling for it.
			// Make sure the old polling process is cancelled even though this should be called before to prevent
			// race conditions.
			ps.cancelPolling()

			pollingContext, cancelFun := context.WithCancel(ctx)
			ps.pollingCtxCancel = cancelFun

			err := provisioner.PollChanges(pollingContext)
			if err != nil {
				// This should not happen. If it was an issue in config files during startup it should have been caught
				// in Init as there the initial provisioning happens. In case of reload API it should also do sync
				// initial provisioning where this error should be caught and we should not start polling.
				ps.cancelPolling()
				ps.log.Error("Polling for changes did not start", "error", err)
			}
		case <-ctx.Done():
			// Root server context was cancelled so just leave.
			return ctx.Err()
		}
	}
}

func (ps *ProvisioningService) ProvisionDatasources() error {
	datasourcePath := path.Join(ps.Cfg.ProvisioningPath, "datasources")
	err := datasources.Provision(datasourcePath)
	return errors.Wrap(err, "Datasource provisioning error")
}

func (ps *ProvisioningService) ProvisionNotifications() error {
	alertNotificationsPath := path.Join(ps.Cfg.ProvisioningPath, "notifiers")
	err := notifiers.Provision(alertNotificationsPath)
	return errors.Wrap(err, "Alert notification provisioning error")
}

func (ps *ProvisioningService) ProvisionDashboards() error {
	dashboardPath := path.Join(ps.Cfg.ProvisioningPath, "dashboards")
	dashProvisioner := dashboards.NewDashboardProvisioner(dashboardPath)
	ps.cancelPolling()

	if err := dashProvisioner.Provision(); err != nil {
		return errors.Wrap(err, "Dashboard provisioning error")
	}
	ps.dashProvisionerChan <- dashProvisioner
	return nil
}

func (ps *ProvisioningService) cancelPolling() {
	if ps.pollingCtxCancel != nil {
		ps.log.Debug("Stop polling for dashboard changes")
		ps.pollingCtxCancel()
	}
	ps.pollingCtxCancel = nil
}
