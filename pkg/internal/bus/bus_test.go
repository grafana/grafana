package bus

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

type testQuery struct {
	ID   int64
	Resp string
}

func TestDispatch(t *testing.T) {
	bus := New()

	var invoked bool

	bus.AddHandler(func(query *testQuery) error {
		invoked = true
		return nil
	})

	err := bus.Dispatch(&testQuery{})
	require.NoError(t, err)

	require.True(t, invoked, "expected handler to be called")
}

func TestDispatch_NoRegisteredHandler(t *testing.T) {
	bus := New()

	err := bus.Dispatch(&testQuery{})
	require.Equal(t, err, ErrHandlerNotFound,
		"expected bus to return HandlerNotFound since no handler is registered")
}

func TestDispatch_ContextHandler(t *testing.T) {
	bus := New()

	var invoked bool

	bus.AddHandlerCtx(func(ctx context.Context, query *testQuery) error {
		invoked = true
		return nil
	})

	err := bus.Dispatch(&testQuery{})
	require.NoError(t, err)

	require.True(t, invoked, "expected handler to be called")
}

func TestDispatchCtx(t *testing.T) {
	bus := New()

	var invoked bool

	bus.AddHandlerCtx(func(ctx context.Context, query *testQuery) error {
		invoked = true
		return nil
	})

	err := bus.DispatchCtx(context.Background(), &testQuery{})
	require.NoError(t, err)

	require.True(t, invoked, "expected handler to be called")
}

func TestDispatchCtx_NoRegisteredHandler(t *testing.T) {
	bus := New()

	err := bus.DispatchCtx(context.Background(), &testQuery{})
	require.Equal(t, err, ErrHandlerNotFound,
		"expected bus to return HandlerNotFound since no handler is registered")
}

func TestQuery(t *testing.T) {
	bus := New()

	want := "hello from handler"

	bus.AddHandler(func(q *testQuery) error {
		q.Resp = want
		return nil
	})

	q := &testQuery{}

	err := bus.Dispatch(q)
	require.NoError(t, err, "unable to dispatch query")

	require.Equal(t, want, q.Resp)
}

func TestQuery_HandlerReturnsError(t *testing.T) {
	bus := New()

	bus.AddHandler(func(query *testQuery) error {
		return errors.New("handler error")
	})

	err := bus.Dispatch(&testQuery{})
	require.Error(t, err, "expected error but got none")
}

func TestEvent(t *testing.T) {
	bus := New()

	var invoked bool

	bus.AddEventListener(func(query *testQuery) error {
		invoked = true
		return nil
	})

	err := bus.Publish(&testQuery{})
	require.NoError(t, err, "unable to publish event")

	require.True(t, invoked)
}

func TestEvent_NoRegisteredListener(t *testing.T) {
	bus := New()

	err := bus.Publish(&testQuery{})
	require.NoError(t, err, "unable to publish event")
}
