package tracing

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/grafana/dskit/modules"
	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
)

func TestModuleManagerWrapper_RegisterModule(t *testing.T) {
	t.Run("registers module with wrapped init function", func(t *testing.T) {
		manager := modules.NewManager(nil)
		wrapper := WrapModuleManager(manager)

		// Set context so getContext doesn't block
		ctx := context.Background()
		wrapper.SetContext(ctx)

		called := false
		mockService := &mockNamedService{name: "test-service"}
		initFn := func() (services.Service, error) {
			called = true
			return mockService, nil
		}

		wrapper.RegisterModule("test-module", initFn)

		// Verify the module was registered
		require.True(t, manager.IsModuleRegistered("test-module"))

		// Initialize the module to test the wrapped init function
		service, err := manager.InitModuleServices("test-module")
		require.NoError(t, err)
		require.True(t, called)
		require.NotNil(t, service)

		// Verify listener was added to the service
		require.Len(t, mockService.listeners, 1)
	})

	t.Run("propagates init function errors", func(t *testing.T) {
		manager := modules.NewManager(nil)
		wrapper := WrapModuleManager(manager)

		// Set context so getContext doesn't block
		ctx := context.Background()
		wrapper.SetContext(ctx)

		expectedErr := errors.New("init error")
		initFn := func() (services.Service, error) {
			return nil, expectedErr
		}

		wrapper.RegisterModule("test-module", initFn)

		// Try to initialize the module
		_, err := manager.InitModuleServices("test-module")
		require.Error(t, err)
		require.Contains(t, err.Error(), expectedErr.Error())
	})

	t.Run("handles nil init function", func(t *testing.T) {
		manager := modules.NewManager(nil)
		wrapper := WrapModuleManager(manager)

		// Set context so getContext doesn't block
		ctx := context.Background()
		wrapper.SetContext(ctx)

		// Register module with nil init function
		wrapper.RegisterModule("nil-module", nil)

		// Verify the module was registered
		require.True(t, manager.IsModuleRegistered("nil-module"))

		// Initialize the module - should work with nil function
		service, err := manager.InitModuleServices("nil-module")
		require.NoError(t, err)
		require.Empty(t, service) // Should return empty map for nil function
	})
}

func TestModuleManagerWrapper_RegisterInvisibleModule(t *testing.T) {
	t.Run("registers invisible module with wrapped init function", func(t *testing.T) {
		manager := modules.NewManager(nil)
		wrapper := WrapModuleManager(manager)

		// Set context so getContext doesn't block
		ctx := context.Background()
		wrapper.SetContext(ctx)

		called := false
		mockService := &mockNamedService{name: "invisible-service"}
		initFn := func() (services.Service, error) {
			called = true
			return mockService, nil
		}

		wrapper.RegisterInvisibleModule("invisible-module", initFn)

		// Verify the module was registered
		require.True(t, manager.IsModuleRegistered("invisible-module"))

		// Initialize the module to test the wrapped init function
		service, err := manager.InitModuleServices("invisible-module")
		require.NoError(t, err)
		require.True(t, called)
		require.NotNil(t, service)

		// Verify listener was added to the service
		require.Len(t, mockService.listeners, 1)
	})

	t.Run("handles nil init function", func(t *testing.T) {
		manager := modules.NewManager(nil)
		wrapper := WrapModuleManager(manager)

		// Set context so getContext doesn't block
		ctx := context.Background()
		wrapper.SetContext(ctx)

		// Register invisible module with nil init function
		wrapper.RegisterInvisibleModule("nil-invisible-module", nil)

		// Verify the module was registered
		require.True(t, manager.IsModuleRegistered("nil-invisible-module"))

		// Initialize the module - should work with nil function
		service, err := manager.InitModuleServices("nil-invisible-module")
		require.NoError(t, err)
		require.Empty(t, service) // Should return empty map for nil function
	})
}

func TestModuleManagerWrapper_SetContext(t *testing.T) {
	t.Run("sets context and closes ready channel", func(t *testing.T) {
		manager := modules.NewManager(nil)
		wrapper := WrapModuleManager(manager)

		ctx := context.Background()

		// Verify ready channel is not closed initially
		select {
		case <-wrapper.ready:
			t.Fatal("ready channel should not be closed initially")
		default:
			// Expected
		}

		wrapper.SetContext(ctx)

		// Verify context is set and ready channel is closed
		require.Equal(t, ctx, wrapper.ctx)
		select {
		case <-wrapper.ready:
			// Expected - channel should be closed
		case <-time.After(100 * time.Millisecond):
			t.Fatal("ready channel should be closed after SetContext")
		}
	})

	t.Run("ignores subsequent calls", func(t *testing.T) {
		manager := modules.NewManager(nil)
		wrapper := WrapModuleManager(manager)

		ctx1 := context.Background()
		type contextKey string
		ctx2 := context.WithValue(context.Background(), contextKey("key"), "value")

		wrapper.SetContext(ctx1)
		wrapper.SetContext(ctx2) // Should be ignored

		require.Equal(t, ctx1, wrapper.ctx)
	})
}

func TestModuleManagerWrapper_getContext(t *testing.T) {
	t.Run("waits for ready channel and returns context", func(t *testing.T) {
		manager := modules.NewManager(nil)
		wrapper := WrapModuleManager(manager)

		ctx := context.Background()

		// Start goroutine to get context
		resultCh := make(chan context.Context)
		go func() {
			resultCh <- wrapper.getContext()
		}()

		// Verify it's waiting
		select {
		case <-resultCh:
			t.Fatal("getContext should wait for ready channel")
		case <-time.After(50 * time.Millisecond):
			// Expected - should be waiting
		}

		// Set context
		wrapper.SetContext(ctx)

		// Verify getContext returns the context
		select {
		case result := <-resultCh:
			require.Equal(t, ctx, result)
		case <-time.After(100 * time.Millisecond):
			t.Fatal("getContext should return after SetContext")
		}
	})
}

func TestModuleManagerWrapper_wrapInitFn(t *testing.T) {
	t.Run("adds listener to NamedService", func(t *testing.T) {
		manager := modules.NewManager(nil)
		wrapper := WrapModuleManager(manager)

		ctx := context.Background()
		wrapper.SetContext(ctx)

		mockService := &mockNamedService{name: "test-service"}
		initFn := func() (services.Service, error) {
			return mockService, nil
		}

		wrappedFn := wrapper.wrapInitFn(initFn)
		service, err := wrappedFn()

		require.NoError(t, err)
		require.Equal(t, mockService, service)

		// Verify listener was added to the service
		require.Len(t, mockService.listeners, 1)
	})

	t.Run("handles regular service without NamedService interface", func(t *testing.T) {
		manager := modules.NewManager(nil)
		wrapper := WrapModuleManager(manager)

		ctx := context.Background()
		wrapper.SetContext(ctx)

		mockService := &mockService{}
		initFn := func() (services.Service, error) {
			return mockService, nil
		}

		wrappedFn := wrapper.wrapInitFn(initFn)
		service, err := wrappedFn()

		require.NoError(t, err)
		require.Equal(t, mockService, service)
		// No listener should be added for non-NamedService
	})

	t.Run("propagates init function errors", func(t *testing.T) {
		manager := modules.NewManager(nil)
		wrapper := WrapModuleManager(manager)

		ctx := context.Background()
		wrapper.SetContext(ctx)

		expectedErr := errors.New("init error")
		initFn := func() (services.Service, error) {
			return nil, expectedErr
		}

		wrappedFn := wrapper.wrapInitFn(initFn)
		service, err := wrappedFn()

		require.Error(t, err)
		require.Equal(t, expectedErr, err)
		require.Nil(t, service)
	})

	t.Run("handles nil service return", func(t *testing.T) {
		manager := modules.NewManager(nil)
		wrapper := WrapModuleManager(manager)

		ctx := context.Background()
		wrapper.SetContext(ctx)

		initFn := func() (services.Service, error) {
			return nil, nil // Return nil service with no error
		}

		wrappedFn := wrapper.wrapInitFn(initFn)
		service, err := wrappedFn()

		require.NoError(t, err)
		require.Nil(t, service)
	})
}

// Mock implementations for testing

type mockService struct {
	listeners []services.Listener
}

func (m *mockService) AddListener(listener services.Listener) func() {
	m.listeners = append(m.listeners, listener)
	return func() {}
}

func (m *mockService) AwaitRunning(ctx context.Context) error {
	return nil
}

func (m *mockService) AwaitTerminated(ctx context.Context) error {
	return nil
}

func (m *mockService) FailureCase() error {
	return nil
}

func (m *mockService) ServiceName() string {
	return "mock-service"
}

func (m *mockService) StartAsync(ctx context.Context) error {
	return nil
}

func (m *mockService) State() services.State {
	return services.New
}

func (m *mockService) StopAsync() {
}

type mockNamedService struct {
	mockService
	name string
}

func (m *mockNamedService) ServiceName() string {
	return m.name
}

func TestModuleManagerWrapper_WaitForListeners(t *testing.T) {
	newWrapperWithListener := func(t *testing.T, name string) (*ModuleManagerWrapper, *Listener) {
		t.Helper()
		wrapper := WrapModuleManager(modules.NewManager(nil))
		wrapper.SetContext(context.Background())

		mockService := &mockNamedService{name: name}
		_, err := wrapper.wrapInitFn(func() (services.Service, error) { return mockService, nil })()
		require.NoError(t, err)
		require.Len(t, wrapper.listeners, 1)

		return wrapper, wrapper.listeners[0]
	}

	t.Run("returns once every listener has seen a final state", func(t *testing.T) {
		wrapper, listener := newWrapperWithListener(t, "test-service")

		listener.Starting()
		listener.Running()
		listener.Stopping(services.Running)

		returned := make(chan struct{})
		go func() {
			defer close(returned)
			wrapper.WaitForListeners(context.Background())
		}()

		select {
		case <-returned:
			require.Fail(t, "WaitForListeners returned before the listener was done")
		case <-time.After(20 * time.Millisecond):
		}

		listener.Terminated(services.Stopping)

		select {
		case <-returned:
		case <-time.After(time.Second):
			require.Fail(t, "WaitForListeners did not return after the listener was done")
		}
	})

	t.Run("gives up when the context is done", func(t *testing.T) {
		wrapper, listener := newWrapperWithListener(t, "stuck-service")
		listener.Starting()

		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
		defer cancel()

		done := make(chan struct{})
		go func() {
			defer close(done)
			wrapper.WaitForListeners(ctx)
		}()

		select {
		case <-done:
		case <-time.After(time.Second):
			require.Fail(t, "WaitForListeners ignored the context deadline")
		}
	})

	t.Run("Failed also marks the listener done", func(t *testing.T) {
		wrapper, listener := newWrapperWithListener(t, "failed-service")

		listener.Starting()
		listener.Failed(services.Starting, errors.New("boom"))

		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		wrapper.WaitForListeners(ctx)
		require.NoError(t, ctx.Err(), "WaitForListeners should have returned before the deadline")
	})

	t.Run("no listeners returns immediately", func(t *testing.T) {
		wrapper := WrapModuleManager(modules.NewManager(nil))
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		wrapper.WaitForListeners(ctx)
		require.NoError(t, ctx.Err())
	})
}
