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
	pauseChan           chan interface{}
	running             bool

	runCtxCancel context.CancelFunc
}

func (ps *ProvisioningService) Init() error {
	ps.log = log.New("provisioning")
	ps.dashProvisionerChan = make(chan *dashboards.DashboardProvisioner, 1)
	ps.pauseChan = make(chan interface{})

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
		select {
		case provisioner := <-ps.dashProvisionerChan:
			ps.log.Debug("Start polling")
			if ps.runCtxCancel != nil {
				ps.runCtxCancel()
			}

			childContext, cancelFun := context.WithCancel(ctx)
			ps.runCtxCancel = cancelFun
			ps.running = true
			provisioner.PollChanges(childContext)
		case <-ctx.Done():
			return ctx.Err()
		case <-ps.pauseChan:
			ps.log.Debug("Polling canceled")
			ps.runCtxCancel()
			ps.running = false
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

	if ps.running {
		ps.pauseChan <- nil
	}
	if err := dashProvisioner.Provision(); err != nil {
		return errors.Wrap(err, "Dashboard provisioning error")
	}
	ps.dashProvisionerChan <- dashProvisioner
	return nil
}
