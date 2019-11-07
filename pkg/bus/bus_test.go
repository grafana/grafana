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

func TestDispatchCtxCanUseNormalHandlers(t *testing.T) {
	bus := New()

	handlerWithCtxCallCount := 0
	handlerCallCount := 0

	handlerWithCtx := func(ctx context.Context, query *testQuery) error {
		handlerWithCtxCallCount++
		return nil
	}

	handler := func(query *testQuery) error {
		handlerCallCount++
		return nil
	}

	err := bus.DispatchCtx(context.Background(), &testQuery{})
	require.Equal(t, err, ErrHandlerNotFound,
		"expected bus to return HandlerNotFound since no handler is registered")

	bus.AddHandler(handler)

	t.Run("when a normal handler is registered", func(t *testing.T) {
		err := bus.Dispatch(&testQuery{})
		require.Nil(t, err)

		require.Equal(t, handlerCallCount, 1,
			"Expected normal handler to be called 1 time. was called %d", handlerCallCount)

		t.Run("when a ctx handler is registered", func(t *testing.T) {
			bus.AddHandlerCtx(handlerWithCtx)
			err := bus.Dispatch(&testQuery{})
			require.Nil(t, err)

			require.Equal(t, handlerWithCtxCallCount, 1,
				"Expected ctx handler to be called 1 time. was called %d", handlerWithCtxCallCount)
		})
	})

}

func TestQueryHandlerReturnsError(t *testing.T) {
	bus := New()
	bus.AddHandler(func(query *testQuery) error {
		return errors.New("handler error")
	})

	err := bus.Dispatch(&testQuery{})
	require.Error(t, err, "Send query failed")
}

func TestQueryHandlerReturn(t *testing.T) {
	bus := New()
	bus.AddHandler(func(q *testQuery) error {
		q.Resp = "hello from handler"
		return nil
	})

	query := &testQuery{}
	err := bus.Dispatch(query)

	require.Nil(t, err, "Send query failed")
}

func TestEventListeners(t *testing.T) {
	bus := New()
	count := 0
	bus.AddEventListener(func(query *testQuery) error {
		count++
		return nil
	})
	bus.AddEventListener(func(query *testQuery) error {
		count += 10
		return nil
	})

	err := bus.Publish(&testQuery{})
	require.Nil(t, err, "Publish event failed")
}
