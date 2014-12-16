package bus

import (
	"errors"
	"reflect"
)

type HandlerFunc interface{}
type Msg interface{}

type Bus interface {
	Dispatch(msg Msg) error
	AddHandler(handler HandlerFunc)
}

type InProcBus struct {
	handlers map[string]HandlerFunc
}

// temp stuff, not sure how to handle bus instance, and init yet
var globalBus = New()

func New() Bus {
	bus := &InProcBus{}
	bus.handlers = make(map[string]HandlerFunc)
	return bus
}

func (b *InProcBus) Dispatch(msg Msg) error {
	var msgName = reflect.TypeOf(msg).Elem().Name()

	var handler = b.handlers[msgName]
	if handler == nil {
		return errors.New("handler not found")
	}

	var params = make([]reflect.Value, 1)
	params[0] = reflect.ValueOf(msg)

	ret := reflect.ValueOf(handler).Call(params)
	err := ret[0].Interface()
	if err == nil {
		return nil
	} else {
		return err.(error)
	}
}

func (b *InProcBus) AddHandler(handler HandlerFunc) {
	handlerType := reflect.TypeOf(handler)
	queryTypeName := handlerType.In(0).Elem().Name()
	b.handlers[queryTypeName] = handler
}

// Package level functions
func AddHandler(implName string, handler HandlerFunc) {
	globalBus.AddHandler(handler)
}

func Dispatch(msg Msg) error {
	return globalBus.Dispatch(msg)
}
