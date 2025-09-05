package adapter

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/stretchr/testify/require"
)

const (
	// Constants for timeout-based tests
	testContextTimeout  = 50 * time.Millisecond
	expectedMinDuration = 45 * time.Millisecond
)

func TestAsNamedService(t *testing.T) {
	t.Run("creates service adapter with correct name", func(t *testing.T) {
		mockSvc := &mockService{}
		adapter := asNamedService(mockSvc)

		require.NotNil(t, adapter)
		require.NotNil(t, adapter.BasicService)

		expectedName := reflect.TypeOf(mockSvc).String()
		require.Equal(t, expectedName, adapter.name)
		require.Equal(t, expectedName, adapter.ServiceName())
		require.Equal(t, mockSvc, adapter.service)
	})

	t.Run("implements NamedService interface", func(t *testing.T) {
		mockSvc := &mockService{}
		adapter := asNamedService(mockSvc)

		// Verify it implements the interface
		require.Implements(t, (*services.NamedService)(nil), adapter)

		// Verify it has the expected methods
		require.NotEmpty(t, adapter.ServiceName())
		require.Equal(t, services.New, adapter.State())
	})

	t.Run("creates BasicService", func(t *testing.T) {
		mockSvc := &mockService{}
		adapter := asNamedService(mockSvc)

		require.NotNil(t, adapter.BasicService)
	})
}
func TestServiceAdapter_Run(t *testing.T) {
	t.Run("run calls underlying service and waits for context", func(t *testing.T) {
		mockSvc := &mockService{}
		mockSvc.runFunc = func(ctx context.Context) error {
			// Simulate service running until context is cancelled
			<-ctx.Done()
			return nil
		}

		adapter := asNamedService(mockSvc)

		ctx, cancel := context.WithTimeout(context.Background(), testContextTimeout)
		defer cancel()

		err := adapter.run(ctx)
		require.NoError(t, err)
		require.True(t, mockSvc.runCalled)
	})

	t.Run("run returns error from underlying service", func(t *testing.T) {
		expectedErr := errors.New("service error")
		mockSvc := &mockService{}
		mockSvc.runError = expectedErr

		adapter := asNamedService(mockSvc)

		err := adapter.run(context.Background())
		require.Error(t, err)
		require.Equal(t, expectedErr, err)
		require.True(t, mockSvc.runCalled)
	})

	t.Run("run waits for context cancellation after service completes", func(t *testing.T) {
		mockSvc := &mockService{}
		// Service completes immediately, adapter should wait for context

		adapter := asNamedService(mockSvc)

		ctx, cancel := context.WithTimeout(context.Background(), testContextTimeout)
		defer cancel()

		start := time.Now()
		err := adapter.run(ctx)
		duration := time.Since(start)

		require.NoError(t, err)
		require.GreaterOrEqual(t, duration, expectedMinDuration) // Should wait for context timeout
		require.True(t, mockSvc.runCalled)
	})

	t.Run("run with immediately cancelled context", func(t *testing.T) {
		mockSvc := &mockService{}
		// Service completes immediately

		adapter := asNamedService(mockSvc)

		ctx, cancel := context.WithCancel(context.Background())
		cancel() // Cancel immediately

		err := adapter.run(ctx)
		require.NoError(t, err)
		require.True(t, mockSvc.runCalled)
	})
}

func TestServiceAdapter_Integration(t *testing.T) {
	t.Run("full lifecycle with BasicService", func(t *testing.T) {
		mockSvc := &mockService{}
		mockSvc.runFunc = func(ctx context.Context) error {
			<-ctx.Done()
			return nil
		}

		adapter := asNamedService(mockSvc)

		// Test that we can start the service
		require.Equal(t, services.New, adapter.State())

		// The BasicService should be properly configured
		require.NotNil(t, adapter.BasicService)
		require.Contains(t, adapter.ServiceName(), "mockService")

		require.False(t, mockSvc.runCalled)
	})

	t.Run("service name reflects actual type", func(t *testing.T) {
		// Test with different service types
		mockSvc1 := &mockService{}
		adapter1 := asNamedService(mockSvc1)

		// Create a different type for comparison
		type anotherMockService struct{ mockService }
		mockSvc2 := &anotherMockService{}
		adapter2 := asNamedService(mockSvc2)

		require.Contains(t, adapter1.ServiceName(), "mockService")
		require.Contains(t, adapter2.ServiceName(), "anotherMockService")
		require.NotEqual(t, adapter1.ServiceName(), adapter2.ServiceName())
	})
}

func TestServiceAdapter_ErrorHandling(t *testing.T) {
	t.Run("service error is propagated", func(t *testing.T) {
		testCases := []struct {
			name string
			err  error
		}{
			{"generic error", errors.New("generic error")},
			{"context error", context.Canceled},
			{"timeout error", context.DeadlineExceeded},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				mockSvc := &mockService{}
				mockSvc.runError = tc.err

				adapter := asNamedService(mockSvc)

				err := adapter.run(context.Background())
				require.Error(t, err)
				require.Equal(t, tc.err, err)
				require.True(t, mockSvc.runCalled)
			})
		}
	})
}

var _ registry.CanBeDisabled = &mockService{}
var _ registry.BackgroundService = &mockService{}

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
