package bus

import (
	"context"
	"errors"
	"fmt"
	"testing"
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
	if err != ErrHandlerNotFound {
		t.Errorf("expected bus to return HandlerNotFound is no handler is registered")
	}

	bus.AddHandler(handler)

	t.Run("when a normal handler is registered", func(t *testing.T) {
		bus.Dispatch(&testQuery{})

		if handlerCallCount != 1 {
			t.Errorf("Expected normal handler to be called 1 time. was called %d", handlerCallCount)
		}

		t.Run("when a ctx handler is registered", func(t *testing.T) {
			bus.AddHandlerCtx(handlerWithCtx)
			bus.Dispatch(&testQuery{})

			if handlerWithCtxCallCount != 1 {
				t.Errorf("Expected ctx handler to be called 1 time. was called %d", handlerWithCtxCallCount)
			}
		})
	})

}

func TestQueryHandlerReturnsError(t *testing.T) {
	bus := New()

	bus.AddHandler(func(query *testQuery) error {
		return errors.New("handler error")
	})

	err := bus.Dispatch(&testQuery{})

	if err == nil {
		t.Fatal("Send query failed")
	} else {
		t.Log("Handler error received ok " + err.Error())
	}
}

func TestQueryHandlerReturn(t *testing.T) {
	bus := New()

	bus.AddHandler(func(q *testQuery) error {
		q.Resp = "hello from handler"
		return nil
	})

	query := &testQuery{}
	err := bus.Dispatch(query)

	if err != nil {
		t.Fatal("Send query failed " + err.Error())
	} else if query.Resp != "hello from handler" {
		t.Fatal("Failed to get response from handler")
	}
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

	if err != nil {
		t.Fatal("Publish event failed " + err.Error())
	} else if count != 11 {
		t.Fatal(fmt.Sprintf("Publish event failed, listeners called: %v, expected: %v", count, 11))
	}
}
