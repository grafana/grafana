package bus

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/stretchr/testify/require"
)

type testQuery struct {
	ID   int64
	Resp string
}

func TestEventPublish(t *testing.T) {
	tracer, err := tracing.InitializeTracerForTest()
	require.NoError(t, err)
	bus := ProvideBus(tracer)

	var invoked bool

	bus.AddEventListener(func(ctx context.Context, query *testQuery) error {
		invoked = true
		return nil
	})

	err = bus.Publish(context.Background(), &testQuery{})
	require.NoError(t, err, "unable to publish event")

	require.True(t, invoked)
}

func TestEventPublish_NoRegisteredListener(t *testing.T) {
	tracer, err := tracing.InitializeTracerForTest()
	require.NoError(t, err)
	bus := ProvideBus(tracer)

	err = bus.Publish(context.Background(), &testQuery{})
	require.NoError(t, err, "unable to publish event")
}

func TestEventCtxPublishCtx(t *testing.T) {
	tracer, err := tracing.InitializeTracerForTest()
	require.NoError(t, err)
	bus := ProvideBus(tracer)

	var invoked bool

	bus.AddEventListener(func(ctx context.Context, query *testQuery) error {
		invoked = true
		return nil
	})

	err = bus.Publish(context.Background(), &testQuery{})
	require.NoError(t, err, "unable to publish event")

	require.True(t, invoked)
}

func TestEventPublishCtx_NoRegisteredListener(t *testing.T) {
	tracer, err := tracing.InitializeTracerForTest()
	require.NoError(t, err)
	bus := ProvideBus(tracer)

	err = bus.Publish(context.Background(), &testQuery{})
	require.NoError(t, err, "unable to publish event")
}

func TestEventPublishCtx(t *testing.T) {
	tracer, err := tracing.InitializeTracerForTest()
	require.NoError(t, err)
	bus := ProvideBus(tracer)

	var invoked bool

	bus.AddEventListener(func(ctx context.Context, query *testQuery) error {
		invoked = true
		return nil
	})

	err = bus.Publish(context.Background(), &testQuery{})
	require.NoError(t, err, "unable to publish event")

	require.True(t, invoked)
}

func TestEventCtxPublish(t *testing.T) {
	tracer, err := tracing.InitializeTracerForTest()
	require.NoError(t, err)
	bus := ProvideBus(tracer)

	var invoked bool

	bus.AddEventListener(func(ctx context.Context, query *testQuery) error {
		invoked = true
		return nil
	})

	err = bus.Publish(context.Background(), &testQuery{})
	require.NoError(t, err, "unable to publish event")

	require.True(t, invoked)
}
