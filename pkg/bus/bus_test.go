package bus

import (
	"errors"
	"fmt"
	"testing"
)

type TestQuery struct {
	Id   int64
	Resp string
}

func TestQueryHandlerReturnsError(t *testing.T) {
	bus := New()

	bus.AddHandler(func(query *TestQuery) error {
		return errors.New("handler error")
	})

	err := bus.Dispatch(&TestQuery{})

	if err == nil {
		t.Fatal("Send query failed " + err.Error())
	} else {
		t.Log("Handler error received ok")
	}
}

func TestQueryHandlerReturn(t *testing.T) {
	bus := New()

	bus.AddHandler(func(q *TestQuery) error {
		q.Resp = "hello from handler"
		return nil
	})

	query := &TestQuery{}
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

	bus.AddEventListener(func(query *TestQuery) error {
		count += 1
		return nil
	})

	bus.AddEventListener(func(query *TestQuery) error {
		count += 10
		return nil
	})

	err := bus.Publish(&TestQuery{})

	if err != nil {
		t.Fatal("Publish event failed " + err.Error())
	} else if count != 11 {
		t.Fatal(fmt.Sprintf("Publish event failed, listeners called: %v, expected: %v", count, 11))
	}
}
