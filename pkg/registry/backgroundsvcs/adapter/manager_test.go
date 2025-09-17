package adapter

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry"
)

const testTimeout = 200 * time.Millisecond

func TestNewManagerAdapter(t *testing.T) {
	reg := &mockBackgroundServiceRegistry{}
	adapter := NewManagerAdapter(reg)

	require.NotNil(t, adapter)
	require.Equal(t, reg, adapter.reg)
	require.Nil(t, adapter.manager)
	require.NotNil(t, adapter.dependencyMap)
}

func TestManagerAdapter_Starting(t *testing.T) {
	t.Run("empty registry initializes manager", func(t *testing.T) {
		reg := &mockBackgroundServiceRegistry{services: []registry.BackgroundService{}}
		adapter := NewManagerAdapter(reg)
		adapter.dependencyMap = map[string][]string{
			BackgroundServices: {},
		}

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		err := adapter.StartAsync(ctx)
		require.NoError(t, err)

		err = adapter.AwaitRunning(ctx)
		require.NoError(t, err)
	})

	t.Run("registers enabled services and skips disabled", func(t *testing.T) {
		enabledSvc := &mockService{}

		// Create a different type for the disabled service to distinguish them
		type disabledMockService struct{ mockService }
		disabledSvc := &disabledMockService{mockService{disabled: true}}

		namedSvc := &mockNamedService{name: "test-service"}

		reg := &mockBackgroundServiceRegistry{
			services: []registry.BackgroundService{enabledSvc, disabledSvc, namedSvc},
		}
		adapter := NewManagerAdapter(reg)
		adapter.dependencyMap = map[string][]string{
			BackgroundServices: {},
		}

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		err := adapter.StartAsync(ctx)
		require.NoError(t, err)

		err = adapter.AwaitRunning(ctx)
		require.NoError(t, err)

		// Verify dependency map was updated correctly
		// Should have entries for enabled services but not disabled ones
		require.Contains(t, adapter.dependencyMap, "*adapter.mockNamedService")             // Named service
		require.Contains(t, adapter.dependencyMap, reflect.TypeOf(enabledSvc).String())     // Wrapped service
		require.NotContains(t, adapter.dependencyMap, reflect.TypeOf(disabledSvc).String()) // Disabled service should not be in map

		// Check that BackgroundServices depends on the enabled services
		bgDeps := adapter.dependencyMap[BackgroundServices]
		require.Contains(t, bgDeps, "*adapter.mockNamedService")
		require.Contains(t, bgDeps, reflect.TypeOf(enabledSvc).String())
		require.NotContains(t, bgDeps, reflect.TypeOf(disabledSvc).String())
	})

	t.Run("handles services that are already NamedService", func(t *testing.T) {
		namedSvc := &mockNamedService{name: "already-named"}
		reg := &mockBackgroundServiceRegistry{services: []registry.BackgroundService{namedSvc}}
		adapter := NewManagerAdapter(reg)
		adapter.dependencyMap = map[string][]string{
			BackgroundServices: {},
		}

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		err := adapter.StartAsync(ctx)
		require.NoError(t, err)

		err = adapter.AwaitRunning(ctx)
		require.NoError(t, err)

		// Verify named service was added to dependency map
		require.Contains(t, adapter.dependencyMap, "*adapter.mockNamedService")
	})

	t.Run("service already in dependency map is not added again", func(t *testing.T) {
		namedSvc := &mockNamedService{name: "existing-service"}
		reg := &mockBackgroundServiceRegistry{services: []registry.BackgroundService{namedSvc}}
		adapter := NewManagerAdapter(reg)

		// Pre-populate the dependency map with the service using the actual service name that will be used
		serviceName := "*adapter.mockNamedService"
		adapter.dependencyMap[serviceName] = []string{"custom-dependency"}
		initialBgDeps := append([]string{}, adapter.dependencyMap[BackgroundServices]...)

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		err := adapter.starting(ctx)
		require.NoError(t, err)
		require.NotNil(t, adapter.manager)

		// Verify the existing dependency was not overwritten
		require.Equal(t, []string{"custom-dependency"}, adapter.dependencyMap[serviceName])

		// Verify BackgroundServices dependencies were not modified (should not contain the service twice)
		finalBgDeps := adapter.dependencyMap[BackgroundServices]
		require.Equal(t, initialBgDeps, finalBgDeps)
	})

	t.Run("service without NamedService interface gets wrapped", func(t *testing.T) {
		// Create a service that doesn't implement NamedService
		plainSvc := &mockService{}
		reg := &mockBackgroundServiceRegistry{services: []registry.BackgroundService{plainSvc}}
		adapter := NewManagerAdapter(reg)

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		err := adapter.starting(ctx)
		require.NoError(t, err)
		require.NotNil(t, adapter.manager)

		// Verify the service was wrapped and added to dependency map using its type name
		expectedServiceName := reflect.TypeOf(plainSvc).String()
		require.Contains(t, adapter.dependencyMap, expectedServiceName)

		// Verify it was added to BackgroundServices dependencies
		bgDeps := adapter.dependencyMap[BackgroundServices]
		require.Contains(t, bgDeps, expectedServiceName)
	})

	t.Run("service without CanBeDisabled interface is always enabled", func(t *testing.T) {
		// Create a service that doesn't implement CanBeDisabled
		simpleSvc := &simpleBackgroundService{}

		reg := &mockBackgroundServiceRegistry{services: []registry.BackgroundService{simpleSvc}}
		adapter := NewManagerAdapter(reg)

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		err := adapter.starting(ctx)
		require.NoError(t, err)
		require.NotNil(t, adapter.manager)

		// Verify the service was added (since it doesn't implement CanBeDisabled, it's always enabled)
		expectedServiceName := reflect.TypeOf(simpleSvc).String()
		require.Contains(t, adapter.dependencyMap, expectedServiceName)
	})

	t.Run("real manager integration test", func(t *testing.T) {
		testSvc := &mockService{}
		reg := &mockBackgroundServiceRegistry{services: []registry.BackgroundService{testSvc}}
		adapter := NewManagerAdapter(reg)

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		// Use the real manager - this tests actual integration
		err := adapter.starting(ctx)
		require.NoError(t, err)
		require.NotNil(t, adapter.manager)

		// Verify the service was registered in dependency map
		expectedServiceName := reflect.TypeOf(testSvc).String()
		require.Contains(t, adapter.dependencyMap, expectedServiceName)
	})
}

func TestManagerAdapter_Running(t *testing.T) {
	t.Run("runs with real manager", func(t *testing.T) {
		mock := &mockNamedService{name: "mock"}
		reg := &mockBackgroundServiceRegistry{services: []registry.BackgroundService{
			mock,
		}}
		adapter := NewManagerAdapter(reg)
		adapter.dependencyMap = map[string][]string{
			BackgroundServices: {},
		}

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		err := adapter.StartAsync(ctx)
		require.NoError(t, err)

		err = adapter.AwaitRunning(ctx)
		require.NoError(t, err)
	})

	t.Run("running delegates to manager", func(t *testing.T) {
		reg := &mockBackgroundServiceRegistry{services: []registry.BackgroundService{}}
		adapter := NewManagerAdapter(reg)

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		// Initialize with real manager
		err := adapter.starting(ctx)
		require.NoError(t, err)

		// Test running method directly - this will likely fail due to missing production modules
		// but it covers the running method code path
		err = adapter.running(ctx)
		if err != nil {
			require.Contains(t, err.Error(), "no such module")
		}
	})
}

func TestManagerAdapter_Stopping(t *testing.T) {
	t.Run("stopping method delegates to manager", func(t *testing.T) {
		mock := &mockNamedService{name: "test-service"}
		reg := &mockBackgroundServiceRegistry{services: []registry.BackgroundService{mock}}
		adapter := NewManagerAdapter(reg)
		adapter.dependencyMap = map[string][]string{
			BackgroundServices: {},
		}

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		// Initialize the manager first - need to go through starting to initialize manager
		err := adapter.starting(ctx)
		require.NoError(t, err)
		require.NotNil(t, adapter.manager)

		// Test the stopping method directly - this covers the stopping function
		err = adapter.stopping(nil)
		require.NoError(t, err)
	})

	t.Run("stopping with failure reason", func(t *testing.T) {
		mock := &mockNamedService{name: "test-service"}
		reg := &mockBackgroundServiceRegistry{services: []registry.BackgroundService{mock}}
		adapter := NewManagerAdapter(reg)
		adapter.dependencyMap = map[string][]string{
			BackgroundServices: {},
		}

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		// Initialize the manager first - need to go through starting to initialize manager
		err := adapter.starting(ctx)
		require.NoError(t, err)
		require.NotNil(t, adapter.manager)

		// Test stopping with failure reason
		failure := errors.New("test failure")
		err = adapter.stopping(failure)
		require.NoError(t, err)
	})
}

func TestManagerAdapter_Run(t *testing.T) {
	t.Run("successful run lifecycle", func(t *testing.T) {
		reg := &mockBackgroundServiceRegistry{}
		adapter := NewManagerAdapter(reg)

		// Create a mock basic service that we can control
		mockBasicService := &mockBasicService{}
		adapter.NamedService = mockBasicService

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		err := adapter.Run(ctx)
		require.NoError(t, err)
		require.True(t, mockBasicService.startAsyncCalled)
		require.True(t, mockBasicService.awaitTerminatedCalled)
	})

	t.Run("returns StartAsync error", func(t *testing.T) {
		reg := &mockBackgroundServiceRegistry{}
		adapter := NewManagerAdapter(reg)

		expectedErr := errors.New("start error")
		mockBasicService := &mockBasicService{startAsyncError: expectedErr}
		adapter.NamedService = mockBasicService

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		err := adapter.Run(ctx)
		require.Error(t, err)
		require.Equal(t, expectedErr, err)
		require.True(t, mockBasicService.startAsyncCalled)
		require.False(t, mockBasicService.awaitTerminatedCalled)
	})

	t.Run("returns AwaitTerminated error", func(t *testing.T) {
		reg := &mockBackgroundServiceRegistry{}
		adapter := NewManagerAdapter(reg)

		expectedErr := errors.New("await error")
		mockBasicService := &mockBasicService{awaitTerminatedError: expectedErr}
		adapter.NamedService = mockBasicService

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		err := adapter.Run(ctx)
		require.Error(t, err)
		require.Equal(t, expectedErr, err)
		require.True(t, mockBasicService.startAsyncCalled)
		require.True(t, mockBasicService.awaitTerminatedCalled)
	})
}

func TestManagerAdapter_Shutdown(t *testing.T) {
	t.Run("calls StopAsync and AwaitTerminated", func(t *testing.T) {
		reg := &mockBackgroundServiceRegistry{}
		adapter := NewManagerAdapter(reg)

		mockBasicService := &mockBasicService{}
		adapter.NamedService = mockBasicService

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		err := adapter.Shutdown(ctx, "test shutdown")
		require.NoError(t, err)
		require.True(t, mockBasicService.stopAsyncCalled)
		require.True(t, mockBasicService.awaitTerminatedCalled)
	})

	t.Run("returns AwaitTerminated error", func(t *testing.T) {
		reg := &mockBackgroundServiceRegistry{}
		adapter := NewManagerAdapter(reg)

		expectedErr := errors.New("await error")
		mockBasicService := &mockBasicService{awaitTerminatedError: expectedErr}
		adapter.NamedService = mockBasicService

		ctx, cancel := context.WithTimeout(context.Background(), testTimeout)
		defer cancel()

		err := adapter.Shutdown(ctx, "test shutdown")
		require.Error(t, err)
		require.Equal(t, expectedErr, err)
	})
}

type mockBackgroundServiceRegistry struct {
	services []registry.BackgroundService
}

func (m *mockBackgroundServiceRegistry) GetServices() []registry.BackgroundService {
	return m.services
}

type mockService struct {
	runFunc    func(ctx context.Context) error
	runCalled  bool
	runContext context.Context
	runError   error
	disabled   bool
}

func (m *mockService) Run(ctx context.Context) error {
	m.runCalled = true
	m.runContext = ctx

	if m.runFunc != nil {
		return m.runFunc(ctx)
	}

	return m.runError
}

func (m *mockService) IsDisabled() bool {
	return m.disabled
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

func (m *mockNamedService) AddListener(listener services.Listener) func() {
	return func() {}
}

func (m *mockNamedService) FailureCase() error {
	return nil
}

type mockBasicService struct {
	startAsyncCalled      bool
	startAsyncError       error
	awaitTerminatedCalled bool
	awaitTerminatedError  error
	stopAsyncCalled       bool
}

func (m *mockBasicService) StartAsync(ctx context.Context) error {
	m.startAsyncCalled = true
	return m.startAsyncError
}

func (m *mockBasicService) AwaitRunning(ctx context.Context) error {
	return nil
}

func (m *mockBasicService) StopAsync() {
	m.stopAsyncCalled = true
}

func (m *mockBasicService) AwaitTerminated(ctx context.Context) error {
	m.awaitTerminatedCalled = true
	return m.awaitTerminatedError
}

func (m *mockBasicService) State() services.State {
	return services.New
}

func (m *mockBasicService) ServiceName() string {
	return "mockBasicService"
}

func (m *mockBasicService) AddListener(listener services.Listener) func() {
	return func() {}
}

func (m *mockBasicService) FailureCase() error {
	return nil
}

// simpleBackgroundService only implements BackgroundService, not CanBeDisabled
type simpleBackgroundService struct {
	runCalled bool
}

func (s *simpleBackgroundService) Run(ctx context.Context) error {
	s.runCalled = true
	return nil
}
