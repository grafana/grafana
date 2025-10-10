package adapter

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/grafana/dskit/services"
	"github.com/stretchr/testify/require"
)

func TestAsNamedService(t *testing.T) {
	t.Run("creates service adapter with correct properties", func(t *testing.T) {
		mockSvc := &mockService{}
		adapter := asNamedService(mockSvc)

		require.NotNil(t, adapter)
		require.NotNil(t, adapter.BasicService)
		require.Equal(t, mockSvc, adapter.service)

		expectedName := reflect.TypeOf(mockSvc).String()
		require.Equal(t, expectedName, adapter.name)
		require.Equal(t, expectedName, adapter.ServiceName())
	})

	t.Run("implements NamedService interface", func(t *testing.T) {
		mockSvc := &mockService{}
		adapter := asNamedService(mockSvc)

		require.Implements(t, (*services.NamedService)(nil), adapter)
		require.NotEmpty(t, adapter.ServiceName())
		require.Equal(t, services.New, adapter.State())
	})

	t.Run("different service types get different names", func(t *testing.T) {
		mockSvc1 := &mockService{}
		adapter1 := asNamedService(mockSvc1)

		type anotherMockService struct{ mockService }
		mockSvc2 := &anotherMockService{}
		adapter2 := asNamedService(mockSvc2)

		require.Contains(t, adapter1.ServiceName(), "mockService")
		require.Contains(t, adapter2.ServiceName(), "anotherMockService")
		require.NotEqual(t, adapter1.ServiceName(), adapter2.ServiceName())
	})
}

func TestServiceAdapter_ErrorHandling(t *testing.T) {
	t.Run("generic error", func(t *testing.T) {
		expectedErr := errors.New("generic error")
		mockSvc := &mockService{}
		mockSvc.runError = expectedErr

		adapter := asNamedService(mockSvc)

		t.Cleanup(func() {
			adapter.StopAsync()
			err := adapter.AwaitTerminated(context.Background())
			require.ErrorIs(t, err, expectedErr)
		})

		err := adapter.StartAsync(context.Background())
		require.NoError(t, err)
		err = adapter.AwaitRunning(context.Background())
		require.ErrorIs(t, err, expectedErr)
		require.True(t, mockSvc.runCalled)
	})

	t.Run("context error", func(t *testing.T) {
		mockSvc := &mockService{}
		mockSvc.runError = context.Canceled

		adapter := asNamedService(mockSvc)

		t.Cleanup(func() {
			adapter.StopAsync()
			err := adapter.AwaitTerminated(context.Background())
			require.NoError(t, err)
		})

		err := adapter.StartAsync(context.Background())
		require.NoError(t, err)
		ctx, cancel := context.WithCancel(context.Background())
		cancel()
		err = adapter.AwaitRunning(ctx)
		require.ErrorIs(t, err, context.Canceled)
	})

	t.Run("timeout error", func(t *testing.T) {
		expectedErr := context.DeadlineExceeded
		mockSvc := &mockService{}
		mockSvc.runError = expectedErr

		adapter := asNamedService(mockSvc)

		t.Cleanup(func() {
			adapter.StopAsync()
			err := adapter.AwaitTerminated(context.Background())
			require.ErrorIs(t, err, expectedErr)
		})
		err := adapter.StartAsync(context.Background())
		require.NoError(t, err)
		err = adapter.AwaitRunning(context.Background())
		require.ErrorIs(t, err, expectedErr)
		require.True(t, mockSvc.runCalled)
	})
}
