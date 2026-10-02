package provisioning

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/infra/serverlock"
	dashboardstore "github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginstore"
	prov_alerting "github.com/grafana/grafana/pkg/services/provisioning/alerting"
	"github.com/grafana/grafana/pkg/services/provisioning/dashboards"
	"github.com/grafana/grafana/pkg/services/provisioning/datasources"
	"github.com/grafana/grafana/pkg/services/provisioning/utils"
	"github.com/grafana/grafana/pkg/setting"
)

func TestProvisioningServiceImpl(t *testing.T) {
	t.Run("Restart dashboard provisioning and stop service", func(t *testing.T) {
		serviceTest := setup(t)
		err := serviceTest.service.ProvisionDashboards(context.Background())
		assert.Nil(t, err)
		serviceTest.startService()
		serviceTest.waitForPollChanges()

		assert.Equal(t, 1, len(serviceTest.mock.Calls.PollChanges), "PollChanges should have been called")

		err = serviceTest.service.ProvisionDashboards(context.Background())
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
		assert.NoError(t, serviceTest.serviceError, "Service should not have returned an error")
	})

	t.Run("Failed reloading does not stop polling with old provisioned", func(t *testing.T) {
		serviceTest := setup(t)
		err := serviceTest.service.ProvisionDashboards(context.Background())
		assert.Nil(t, err)
		serviceTest.startService()
		serviceTest.waitForPollChanges()
		assert.Equal(t, 1, len(serviceTest.mock.Calls.PollChanges), "PollChanges should have been called")

		serviceTest.mock.ProvisionFunc = func(ctx context.Context) error {
			return errors.New("Test error")
		}
		err = serviceTest.service.ProvisionDashboards(context.Background())
		assert.NotNil(t, err)
		serviceTest.waitForPollChanges()

		// This should have been called with the old provisioner, after the last one failed.
		assert.Equal(t, 2, len(serviceTest.mock.Calls.PollChanges), "PollChanges should have been called 2 times")
		assert.True(t, serviceTest.serviceRunning, "Service should be still running")

		// Cancelling the root context and stopping the service
		serviceTest.cancel()
	})

	t.Run("Should not return run error when dashboard provisioning fails because of folder", func(t *testing.T) {
		serviceTest := setup(t)
		provisioningErr := fmt.Errorf("%w: Test error", dashboards.ErrGetOrCreateFolder)
		serviceTest.mock.ProvisionFunc = func(ctx context.Context) error {
			return provisioningErr
		}
		err := serviceTest.service.ProvisionDashboards(context.Background())
		assert.NotNil(t, err)
		serviceTest.startService()

		serviceTest.waitForPollChanges()
		assert.Equal(t, 1, len(serviceTest.mock.Calls.PollChanges), "PollChanges should have been called")

		// Cancelling the root context and stopping the service
		serviceTest.cancel()
		serviceTest.waitForStop()

		assert.NoError(t, serviceTest.serviceError, "Service should not have returned an error")
	})

	t.Run("Should retry dashboard provisioning while the folder API is unavailable", func(t *testing.T) {
		serviceTest := setup(t)
		serviceTest.service.dashboardProvisionRetries = 5

		var calls int
		serviceTest.mock.ProvisionFunc = func(ctx context.Context) error {
			calls++
			if calls < 3 {
				return fmt.Errorf("%w: %w", dashboards.ErrGetOrCreateFolder, apierrors.NewServiceUnavailable("folder API unavailable"))
			}
			return nil
		}

		serviceTest.startService()
		serviceTest.waitForPollChanges()

		// Provisioning should have been retried until it succeeded, so polling starts.
		assert.Equal(t, 3, calls, "Provision should have been retried until it succeeded")
		assert.Equal(t, 1, len(serviceTest.mock.Calls.PollChanges), "PollChanges should have been called")

		serviceTest.cancel()
		serviceTest.waitForStop()

		assert.NoError(t, serviceTest.serviceError, "Service should not have returned an error")
	})

	t.Run("Should retry transient gRPC search failures from unified storage", func(t *testing.T) {
		serviceTest := setup(t)
		serviceTest.service.dashboardProvisionRetries = 5

		var calls int
		serviceTest.mock.ProvisionFunc = func(ctx context.Context) error {
			calls++
			if calls < 3 {
				return fmt.Errorf("%w: %w", dashboards.ErrGetOrCreateFolder, status.Error(codes.Unavailable, "search unavailable"))
			}
			return nil
		}

		serviceTest.startService()
		serviceTest.waitForPollChanges()

		assert.Equal(t, 3, calls, "transient gRPC errors should be retried until success")
		assert.Equal(t, 1, len(serviceTest.mock.Calls.PollChanges), "PollChanges should have been called")

		serviceTest.cancel()
		serviceTest.waitForStop()

		assert.NoError(t, serviceTest.serviceError, "Service should not have returned an error")
	})

	t.Run("Should stop retrying and allow-list a persistent folder outage", func(t *testing.T) {
		serviceTest := setup(t)
		serviceTest.service.dashboardProvisionRetries = 2

		var calls int
		serviceTest.mock.ProvisionFunc = func(ctx context.Context) error {
			calls++
			return fmt.Errorf("%w: %w", dashboards.ErrGetOrCreateFolder, apierrors.NewServiceUnavailable("folder API unavailable"))
		}

		serviceTest.startService()
		serviceTest.waitForPollChanges()

		// Initial attempt + dashboardProvisionRetries, then the error is allow-listed.
		assert.Equal(t, 3, calls, "Provision should have been attempted once plus the configured retries")
		serviceTest.cancel()
		serviceTest.waitForStop()

		assert.NoError(t, serviceTest.serviceError, "Service should not have returned an error")
	})

	t.Run("Should not retry a permanent folder configuration error", func(t *testing.T) {
		serviceTest := setup(t)
		serviceTest.service.dashboardProvisionRetries = 5
		// A long backoff would make this test hang if the error were wrongly retried.
		serviceTest.service.dashboardProvisionRetryBackoff = time.Hour

		var calls int
		serviceTest.mock.ProvisionFunc = func(ctx context.Context) error {
			calls++
			return fmt.Errorf("%w with name %q: max nested folder depth reached", dashboards.ErrGetOrCreateFolder, "general")
		}

		serviceTest.startService()
		serviceTest.waitForPollChanges()

		// Permanent config errors must not be retried, and are still allow-listed.
		assert.Equal(t, 1, calls, "Provision should have been attempted exactly once")
		serviceTest.cancel()
		serviceTest.waitForStop()

		assert.NoError(t, serviceTest.serviceError, "Service should not have returned an error")
	})

	t.Run("Should return context error when cancelled during retry backoff", func(t *testing.T) {
		serviceTest := setup(t)
		serviceTest.service.dashboardProvisionRetries = 5
		serviceTest.service.dashboardProvisionRetryBackoff = time.Hour

		serviceTest.mock.ProvisionFunc = func(ctx context.Context) error {
			return fmt.Errorf("%w: %w", dashboards.ErrGetOrCreateFolder, apierrors.NewServiceUnavailable("folder API unavailable"))
		}

		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		err := serviceTest.service.provisionDashboardsWithRetry(ctx)
		// Cancellation must not be masked as an allow-listed folder failure.
		require.ErrorIs(t, err, context.Canceled)
		require.NotErrorIs(t, err, dashboards.ErrGetOrCreateFolder)
	})

	t.Run("Should return run error when dashboard provisioning fails for non-allow-listed error", func(t *testing.T) {
		serviceTest := setup(t)
		provisioningErr := errors.New("Non-allow-listed error")
		serviceTest.mock.ProvisionFunc = func(ctx context.Context) error {
			return provisioningErr
		}
		err := serviceTest.service.ProvisionDashboards(context.Background())
		assert.NotNil(t, err)
		serviceTest.startService()

		serviceTest.waitForPollChanges()
		assert.Equal(t, 0, len(serviceTest.mock.Calls.PollChanges), "PollChanges should have been called")

		// Cancelling the root context and stopping the service
		serviceTest.cancel()
		serviceTest.waitForStop()

		assert.True(t, errors.Is(serviceTest.serviceError, provisioningErr))
	})
	t.Run("Should set dashboard provisioner when provisioning dashboards", func(t *testing.T) {
		// The first dashboard provisioner instantiation takes place when
		// setDashboardProvisioner() is called in setup(t).
		serviceTest := setup(t)
		// The second dashboard provisioner instantiation takes place when
		// Run(ctx) is executed.
		serviceTest.startService()

		serviceTest.cancel()
		serviceTest.waitForStop()

		assert.Equal(t, 2, serviceTest.dashboardProvisionerInstantiations)
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

	dashboardProvisionerInstantiations int

	mock    *dashboards.ProvisionerMock
	service *ProvisioningServiceImpl
}

func setup(t *testing.T) *serviceTestStruct {
	serviceTest := &serviceTestStruct{}
	serviceTest.waitTimeout = time.Second

	pollChangesChannel := make(chan context.Context)
	serviceStopped := make(chan interface{})

	serviceTest.mock = dashboards.NewDashboardProvisionerMock()
	serviceTest.mock.PollChangesFunc = func(ctx context.Context) {
		pollChangesChannel <- ctx
	}

	service, err := newProvisioningServiceImpl(
		func(context.Context, string, dashboardstore.DashboardProvisioningService, *setting.Cfg, org.Service, utils.DashboardStore, folder.Service, *serverlock.ServerLockService) (dashboards.DashboardProvisioner, error) {
			serviceTest.dashboardProvisionerInstantiations++
			return serviceTest.mock, nil
		},
		func(context.Context, string, datasources.BaseDataSourceService, datasources.CorrelationsStore, org.Service) error {
			return nil
		},
		func(context.Context, string, pluginstore.Store, pluginsettings.Service, org.Service) error {
			return nil
		},
		func(context.Context) error {
			return nil
		},
	)
	service.provisionAlerting = func(context.Context, prov_alerting.ProvisionerConfig) error {
		return nil
	}
	serviceTest.service = service
	require.NoError(t, err)

	// Keep retries fast so tests exercising folder failures do not block.
	serviceTest.service.dashboardProvisionRetryBackoff = time.Millisecond

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
