package provisioning

import (
	"context"
	"errors"
	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"testing"
	"time"
)

func TestProvisioningServiceImpl(t *testing.T) {
	t.Run("Restart dashboard provisioning and stop service", func(t *testing.T) {
		service, mock := setup()
		ctx, cancel := context.WithCancel(context.Background())
		var serviceRunning bool
		var serviceError error

		err := service.ProvisionDashboards()
		assert.Nil(t, err)
		go func() {
			serviceRunning = true
			serviceError = service.Run(ctx)
			serviceRunning = false
		}()
		time.Sleep(time.Millisecond)
		assert.Equal(t, 1, len(mock.Calls.PollChanges), "PollChanges should have been called")

		err = service.ProvisionDashboards()
		assert.Nil(t, err)
		time.Sleep(time.Millisecond)
		assert.Equal(t, 2, len(mock.Calls.PollChanges), "PollChanges should have been called 2 times")

		pollingCtx := mock.Calls.PollChanges[0].(context.Context)
		assert.Equal(t, context.Canceled, pollingCtx.Err(), "Polling context from first call should have been cancelled")
		assert.True(t, serviceRunning, "Service should be still running")

		// Cancelling the root context and stopping the service
		cancel()
		time.Sleep(time.Millisecond)

		assert.False(t, serviceRunning, "Service should not be running")
		assert.Equal(t, context.Canceled, serviceError, "Service should have returned canceled error")

	})

	t.Run("Failed reloading does not stop polling with old provisioned", func(t *testing.T) {
		service, mock := setup()
		ctx, cancel := context.WithCancel(context.Background())
		var serviceRunning bool

		err := service.ProvisionDashboards()
		assert.Nil(t, err)
		go func() {
			serviceRunning = true
			_ = service.Run(ctx)
			serviceRunning = false
		}()
		time.Sleep(time.Millisecond)
		assert.Equal(t, 1, len(mock.Calls.PollChanges), "PollChanges should have been called")

		mock.ProvisionFunc = func() error {
			return errors.New("Test error")
		}
		err = service.ProvisionDashboards()
		assert.NotNil(t, err)
		time.Sleep(time.Millisecond)
		// This should have been called with the old provisioner, after the last one failed.
		assert.Equal(t, 2, len(mock.Calls.PollChanges), "PollChanges should have been called 2 times")
		assert.True(t, serviceRunning, "Service should be still running")

		// Cancelling the root context and stopping the service
		cancel()

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
