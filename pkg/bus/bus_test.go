package bus

import (
	"errors"
	"testing"
)

type TestQuery struct {
	Id   int64
	Resp string
}

func TestHandlerReturnsError(t *testing.T) {
	InitBus()

	AddQueryHandler(func(query *TestQuery) error {
		return errors.New("handler error")
	})

	err := SendQuery(&TestQuery{})

	if err == nil {
		t.Fatal("Send query failed %v", err)
	} else {
		t.Log("Handler error received ok")
	}
}

func TestHandlerReturn(t *testing.T) {
	InitBus()

	AddQueryHandler(func(q *TestQuery) error {
		q.Resp = "hello from handler"
		return nil
	})

	query := &TestQuery{}
	err := SendQuery(query)

	if err != nil {
		t.Fatal("Send query failed %v", err)
	} else if query.Resp != "hello from handler" {
		t.Fatal("Failed to get response from handler")
	}
}
