package provisioning

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestProvisioningServiceImpl(t *testing.T) {
	t.Run("Restart dashboard provisioning and stop service", func(t *testing.T) {
		serviceTest := setup()
		err := serviceTest.service.ProvisionDashboards()
		assert.Nil(t, err)
		serviceTest.startService()
		serviceTest.waitForPollChanges()

		assert.Equal(t, 1, len(serviceTest.mock.Calls.PollChanges), "PollChanges should have been called")

		err = serviceTest.service.ProvisionDashboards()
		assert.Nil(t, err)

		serviceTest.waitForPollChanges()
		assert.Equal(t, 2, len(serviceTest.mock.Calls.PollChanges), "PollChanges should have been called 2 times")

		pollingCtx := serviceTest.mock.Calls.PollChanges[0].(context.Context)
		assert.Equal(t, context.Canceled, pollingCtx.Err(), "Polling context from first call should have been cancelled")
		assert.True(t, serviceTest.serviceRunning, "Service should be still running")

		// Cancelling the root context and stopping the service
		serviceTest.cancel()
		serviceTest.waitForStop()

		assert.False(t, serviceTest.serviceRunning, "Service should not be running")
		assert.Equal(t, context.Canceled, serviceTest.serviceError, "Service should have returned canceled error")
	})

	t.Run("Failed reloading does not stop polling with old provisioned", func(t *testing.T) {
		serviceTest := setup()
		err := serviceTest.service.ProvisionDashboards()
		assert.Nil(t, err)
		serviceTest.startService()
		serviceTest.waitForPollChanges()
		assert.Equal(t, 1, len(serviceTest.mock.Calls.PollChanges), "PollChanges should have been called")

		serviceTest.mock.ProvisionFunc = func() error {
			return errors.New("Test error")
		}
		err = serviceTest.service.ProvisionDashboards()
		assert.NotNil(t, err)
		serviceTest.waitForPollChanges()

		// This should have been called with the old provisioner, after the last one failed.
		assert.Equal(t, 2, len(serviceTest.mock.Calls.PollChanges), "PollChanges should have been called 2 times")
		assert.True(t, serviceTest.serviceRunning, "Service should be still running")

		// Cancelling the root context and stopping the service
		serviceTest.cancel()
	})
}

type serviceTestStruct struct {
	waitForPollChanges func()
	waitForStop        func()
	waitTimeout        time.Duration

	serviceRunning bool
	serviceError   error

	startService func()
	cancel       func()

	mock    *dashboards.ProvisionerMock
	service *provisioningServiceImpl
}

func setup() *serviceTestStruct {
	serviceTest := &serviceTestStruct{}
	serviceTest.waitTimeout = time.Second

	pollChangesChannel := make(chan context.Context)
	serviceStopped := make(chan interface{})

	serviceTest.mock = dashboards.NewDashboardProvisionerMock()
	serviceTest.mock.PollChangesFunc = func(ctx context.Context) {
		pollChangesChannel <- ctx
	}

	serviceTest.service = NewProvisioningServiceImpl(
		func(path string) (dashboards.DashboardProvisioner, error) {
			return serviceTest.mock, nil
		},
		nil,
		nil,
		nil,
	)
	serviceTest.service.Cfg = setting.NewCfg()

	ctx, cancel := context.WithCancel(context.Background())
	serviceTest.cancel = cancel

	serviceTest.startService = func() {
		go func() {
			serviceTest.serviceRunning = true
			serviceTest.serviceError = serviceTest.service.Run(ctx)
			serviceTest.serviceRunning = false
			serviceStopped <- true
		}()
	}

	serviceTest.waitForPollChanges = func() {
		timeoutChan := time.After(serviceTest.waitTimeout)
		select {
		case <-pollChangesChannel:
		case <-timeoutChan:
		}
	}

	serviceTest.waitForStop = func() {
		timeoutChan := time.After(serviceTest.waitTimeout)
		select {
		case <-serviceStopped:
		case <-timeoutChan:
		}
	}

	return serviceTest
}
