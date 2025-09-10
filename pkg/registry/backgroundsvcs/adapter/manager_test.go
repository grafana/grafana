package adapter

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry"
)

func TestNewManagerAdapter(t *testing.T) {
	reg := &mockBackgroundServiceRegistry{}
	adapter := NewManagerAdapter(reg)

	require.NotNil(t, adapter)
	require.Equal(t, reg, adapter.reg)
	require.Nil(t, adapter.manager)
}

func TestManagerAdapter_Run(t *testing.T) {
	t.Run("empty registry initializes manager", func(t *testing.T) {
		reg := &mockBackgroundServiceRegistry{services: []registry.BackgroundService{}}
		adapter := NewManagerAdapter(reg)

		// Test that Run initializes the manager properly
		ctx, cancel := context.WithCancel(context.Background())
		cancel() // Cancel immediately to avoid hanging

		err := adapter.Run(ctx)
		require.NoError(t, err)
		require.NotNil(t, adapter.manager)
	})

	t.Run("services are registered and called", func(t *testing.T) {
		mockSvc := &mockService{}
		// Make the service block until context is cancelled
		mockSvc.runFunc = func(ctx context.Context) error {
			<-ctx.Done()
			return nil
		}

		reg := &mockBackgroundServiceRegistry{services: []registry.BackgroundService{mockSvc}}
		adapter := NewManagerAdapter(reg)

		ctx, cancel := context.WithTimeout(context.Background(), testContextTimeout)
		defer cancel()

		err := adapter.Run(ctx)
		require.NoError(t, err)
		require.NotNil(t, adapter.manager)
		require.True(t, mockSvc.runCalled)
	})
}

func TestManagerAdapter_Run_ServiceTypes(t *testing.T) {
	t.Run("service without NamedService interface gets converted", func(t *testing.T) {
		mockSvc := &mockService{}
		mockSvc.runFunc = func(ctx context.Context) error {
			<-ctx.Done()
			return nil
		}

		reg := &mockBackgroundServiceRegistry{
			services: []registry.BackgroundService{mockSvc},
		}
		adapter := NewManagerAdapter(reg)

		ctx, cancel := context.WithTimeout(context.Background(), testContextTimeout)
		defer cancel()

		err := adapter.Run(ctx)
		require.NoError(t, err)
		require.NotNil(t, adapter.manager)

		// Verify the service was called
		require.True(t, mockSvc.runCalled)
	})

	t.Run("service with NamedService interface is used directly", func(t *testing.T) {
		mockSvc := &mockNamedService{name: "custom-service"}
		mockSvc.runFunc = func(ctx context.Context) error {
			<-ctx.Done()
			return nil
		}

		reg := &mockBackgroundServiceRegistry{
			services: []registry.BackgroundService{mockSvc},
		}
		adapter := NewManagerAdapter(reg)

		ctx, cancel := context.WithTimeout(context.Background(), testContextTimeout)
		defer cancel()

		err := adapter.Run(ctx)
		require.NoError(t, err)
		require.NotNil(t, adapter.manager)

		// Verify the service was called
		require.True(t, mockSvc.runCalled)
	})

	t.Run("disabled service is skipped", func(t *testing.T) {
		disabledSvc := &mockService{}
		disabledSvc.disabled = true
		enabledSvc := &mockService{}
		enabledSvc.runFunc = func(ctx context.Context) error {
			<-ctx.Done()
			return nil
		}

		reg := &mockBackgroundServiceRegistry{
			services: []registry.BackgroundService{disabledSvc, enabledSvc},
		}
		adapter := NewManagerAdapter(reg)

		ctx, cancel := context.WithTimeout(context.Background(), testContextTimeout)
		defer cancel()

		err := adapter.Run(ctx)
		require.NoError(t, err)
		require.NotNil(t, adapter.manager)

		// Verify only enabled service was called
		require.False(t, disabledSvc.runCalled)
		require.True(t, enabledSvc.runCalled)
	})
}

func TestManagerAdapter_Shutdown(t *testing.T) {
	t.Run("shutdown with nil manager returns nil", func(t *testing.T) {
		reg := &mockBackgroundServiceRegistry{}
		adapter := NewManagerAdapter(reg)

		err := adapter.Shutdown(context.Background(), "test shutdown")
		require.NoError(t, err)
	})

	t.Run("shutdown with initialized manager", func(t *testing.T) {
		mockSvc := &mockService{}
		mockSvc.runFunc = func(ctx context.Context) error {
			<-ctx.Done()
			return nil
		}

		reg := &mockBackgroundServiceRegistry{
			services: []registry.BackgroundService{mockSvc},
		}
		adapter := NewManagerAdapter(reg)

		// Initialize the manager
		ctx, cancel := context.WithTimeout(context.Background(), testContextTimeout)
		defer cancel()

		go func() {
			err := adapter.Run(ctx)
			require.NoError(t, err)
		}()

		// Give it a moment to initialize, then test shutdown
		require.Eventually(t, func() bool {
			return adapter.manager != nil
		}, testContextTimeout, 5*time.Millisecond)

		err := adapter.Shutdown(context.Background(), "test shutdown")
		require.NoError(t, err)
	})
}

func TestManagerAdapter_MultipleServices(t *testing.T) {
	t.Run("multiple services are registered", func(t *testing.T) {
		mockSvc1 := &mockService{}
		mockSvc2 := &mockService{}

		reg := &mockBackgroundServiceRegistry{
			services: []registry.BackgroundService{mockSvc1, mockSvc2},
		}
		adapter := NewManagerAdapter(reg)

		require.NotNil(t, adapter)
		require.Equal(t, reg, adapter.reg)
		require.Len(t, reg.GetServices(), 2)
	})
}

type mockBackgroundServiceRegistry struct {
	services []registry.BackgroundService
}

func (m *mockBackgroundServiceRegistry) GetServices() []registry.BackgroundService {
	return m.services
}

type mockNamedService struct {
	mockService
	name string
}

func (m *mockNamedService) ServiceName() string {
	return m.name
}

func (m *mockNamedService) State() services.State {
	return services.New
}
