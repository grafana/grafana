package provisioning

import (
	"context"
	"github.com/bmizerany/assert"
	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
	"github.com/grafana/grafana/pkg/setting"
	"testing"
	"time"
)

func TestProvisioningServiceImpl(t *testing.T) {
	t.Run("Restart dashboard provisioning and stop service", func(t *testing.T) {
		service, mock := setup()
		ctx, cancel := context.WithCancel(context.Background())
		var serviceRunning bool
		var serviceError error
		go func() {
			serviceRunning = true
			serviceError = service.Run(ctx)
			serviceRunning = false
		}()

		assert.Equal(t, len(mock.Calls.PollChanges), 0, "PollChanges should not have been called")

		service.ProvisionDashboards()
		time.Sleep(time.Millisecond)
		assert.Equal(t, len(mock.Calls.PollChanges), 1, "PollChanges should have been called")

		service.ProvisionDashboards()
		time.Sleep(time.Millisecond)
		assert.Equal(t, len(mock.Calls.PollChanges), 2, "PollChanges should have been called 2 times")

		pollingCtx := mock.Calls.PollChanges[0].(context.Context)
		assert.Equal(t, pollingCtx.Err(), context.Canceled, "Polling context from first call should have been cancelled")
		assert.Equal(t, serviceRunning, true, "Service should be still running")

		// Cancelling the root context and stopping the service
		cancel()
		time.Sleep(time.Millisecond)

		assert.Equal(t, serviceRunning, false, "Service should not be running")
		assert.Equal(t, serviceError, context.Canceled, "Service should have returned canceled error")

	})
}

func setup() (*provisioningServiceImpl, *dashboards.DashboardProvisionerMock) {
	dashMock := dashboards.NewDashboardProvisionerMock()
	service := NewProvisioningServiceImpl(
		func(path string) (dashboards.DashboardProvisioner, error) {
			return dashMock, nil
		},
		nil,
		nil,
	)
	service.Cfg = setting.NewCfg()
	return service, dashMock
}
