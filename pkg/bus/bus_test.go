package bus

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/tracing"
)

type testQuery struct {
	ID   int64
	Resp string
}

func TestEventPublish(t *testing.T) {
	bus := ProvideBus(tracing.InitializeTracerForTest())

	var invoked bool

	bus.AddEventListener(func(ctx context.Context, query *testQuery) error {
		invoked = true
		return nil
	})

	err := bus.Publish(context.Background(), &testQuery{})
	require.NoError(t, err, "unable to publish event")

	require.True(t, invoked)
}

func TestEventPublish_NoRegisteredListener(t *testing.T) {
	bus := ProvideBus(tracing.InitializeTracerForTest())

	err := bus.Publish(context.Background(), &testQuery{})
	require.NoError(t, err, "unable to publish event")
}

func TestEventCtxPublishCtx(t *testing.T) {
	bus := ProvideBus(tracing.InitializeTracerForTest())

	var invoked bool

	bus.AddEventListener(func(ctx context.Context, query *testQuery) error {
		invoked = true
		return nil
	})

	err := bus.Publish(context.Background(), &testQuery{})
	require.NoError(t, err, "unable to publish event")

	require.True(t, invoked)
}

func TestEventPublishCtx_NoRegisteredListener(t *testing.T) {
	bus := ProvideBus(tracing.InitializeTracerForTest())

	err := bus.Publish(context.Background(), &testQuery{})
	require.NoError(t, err, "unable to publish event")
}

func TestEventPublishCtx(t *testing.T) {
	bus := ProvideBus(tracing.InitializeTracerForTest())

	var invoked bool

	bus.AddEventListener(func(ctx context.Context, query *testQuery) error {
		invoked = true
		return nil
	})

	err := bus.Publish(context.Background(), &testQuery{})
	require.NoError(t, err, "unable to publish event")

	require.True(t, invoked)
}

func TestEventCtxPublish(t *testing.T) {
	bus := ProvideBus(tracing.InitializeTracerForTest())

	var invoked bool

	bus.AddEventListener(func(ctx context.Context, query *testQuery) error {
		invoked = true
		return nil
	})

	err := bus.Publish(context.Background(), &testQuery{})
	require.NoError(t, err, "unable to publish event")

	require.True(t, invoked)
}

func TestEventListenerError(t *testing.T) {
	bus := ProvideBus(tracing.InitializeTracerForTest())

	mockErr := errors.New("error")

	invocations := 0

	// Will be called in order of declaration.
	bus.AddEventListener(func(ctx context.Context, query *testQuery) error {
		invocations++
		return nil
	})

	bus.AddEventListener(func(ctx context.Context, query *testQuery) error {
		invocations++
		return mockErr
	})

	bus.AddEventListener(func(ctx context.Context, query *testQuery) {
		invocations++
	})

	err := bus.Publish(context.Background(), &testQuery{})
	require.ErrorIs(t, err, mockErr)
	require.Equal(t, 2, invocations)
}

func TestEventListenerInvalidCallbackType(t *testing.T) {
	bus := ProvideBus(tracing.InitializeTracerForTest())

	invoked := false

	bus.AddEventListener(func(ctx context.Context, query *testQuery) bool {
		invoked = true
		return invoked
	})

	err := bus.Publish(context.Background(), &testQuery{})
	require.Error(t, err)
	require.True(t, invoked)
}

func TestEventListenerInvalidCallback(t *testing.T) {
	bus := ProvideBus(tracing.InitializeTracerForTest())

	invoked := false

	bus.AddEventListener(func(ctx context.Context, query *testQuery) {
		invoked = true
	})

	require.Panics(t, func() {
		err := bus.Publish(context.Background(), &testQuery{})
		require.NoError(t, err) // unreachable
	})
	require.True(t, invoked)
}
