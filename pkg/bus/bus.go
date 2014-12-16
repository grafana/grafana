package bus

import (
	"errors"
	"fmt"
	"reflect"
)

type QueryHandler interface{}
type Query interface{}

type Bus interface {
	SendQuery(query Query) error
	AddQueryHandler(handler QueryHandler)
}

type InProcBus struct {
	handlerIndex map[string]QueryHandler
}

// temp stuff, not sure how to handle bus instance, and init yet
var globalBus = New()

func New() Bus {
	bus := &InProcBus{}
	bus.handlerIndex = make(map[string]QueryHandler)
	return bus
}

func (b *InProcBus) SendQuery(query Query) error {
	var queryName = reflect.TypeOf(query).Elem().Name()
	fmt.Printf("sending query for type: %v\n", queryName)

	var handler = b.handlerIndex[queryName]
	if handler == nil {
		return errors.New("handler not found")

	}
	var params = make([]reflect.Value, 1)
	params[0] = reflect.ValueOf(query)

	ret := reflect.ValueOf(handler).Call(params)
	err := ret[0].Interface()
	if err == nil {
		return nil
	} else {
		return err.(error)
	}
}

func (b *InProcBus) AddQueryHandler(handler QueryHandler) {
	handlerType := reflect.TypeOf(handler)
	queryTypeName := handlerType.In(0).Elem().Name()
	fmt.Printf("QueryType %v\n", queryTypeName)
	b.handlerIndex[queryTypeName] = handler
}

// Package level functions
func AddQueryHandler(implName string, handler QueryHandler) {
	globalBus.AddQueryHandler(handler)
}

func SendQuery(query Query) error {
	return globalBus.SendQuery(query)
}
