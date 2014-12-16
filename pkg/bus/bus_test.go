package bus

import (
	"errors"
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
