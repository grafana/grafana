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

func TestDispatchCtx(t *testing.T) {
	bus := New()

	err := bus.DispatchCtx(context.Background(), &testQuery{})
	if err != ErrHandlerNotFound {
		t.Errorf("expected bus to return HandlerNotFound is no handler is registered")
	}
}

func TestQueryHandlerReturnsError(t *testing.T) {
	bus := New()

	bus.AddHandlerCtx(func(ctx context.Context, query *testQuery) error {
		return errors.New("handler error")
	})

	err := bus.DispatchCtx(context.Background(), &testQuery{})

	if err == nil {
		t.Fatal("Send query failed")
	} else {
		t.Log("Handler error received ok " + err.Error())
	}
}

func TestQueryHandlerReturn(t *testing.T) {
	bus := New()

	bus.AddHandlerCtx(func(ctx context.Context, q *testQuery) error {
		q.Resp = "hello from handler"
		return nil
	})

	query := &testQuery{}
	err := bus.DispatchCtx(context.Background(), query)

	if err != nil {
		t.Fatal("Send query failed " + err.Error())
	} else if query.Resp != "hello from handler" {
		t.Fatal("Failed to get response from handler")
	}
}

func TestEventListeners(t *testing.T) {
	bus := New()
	count := 0

	bus.AddEventListener(func(ctx context.Context, query *testQuery) error {
		count++
		return nil
	})

	bus.AddEventListener(func(ctx context.Context, query *testQuery) error {
		count += 10
		return nil
	})

	err := bus.Publish(context.Background(), &testQuery{})

	if err != nil {
		t.Fatal("Publish event failed " + err.Error())
	} else if count != 11 {
		t.Fatal(fmt.Sprintf("Publish event failed, listeners called: %v, expected: %v", count, 11))
	}
}
