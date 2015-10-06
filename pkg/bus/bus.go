package bus

import (
	"fmt"
	"reflect"
)

type HandlerFunc interface{}
type Msg interface{}

type Bus interface {
	Dispatch(msg Msg) error
	Publish(msg Msg) error

	AddHandler(handler HandlerFunc)
	AddEventListener(handler HandlerFunc)
	AddWildcardListener(handler HandlerFunc)
}

type InProcBus struct {
	handlers          map[string]HandlerFunc
	listeners         map[string][]HandlerFunc
	wildcardListeners []HandlerFunc
}

// temp stuff, not sure how to handle bus instance, and init yet
var globalBus = New()

func New() Bus {
	bus := &InProcBus{}
	bus.handlers = make(map[string]HandlerFunc)
	bus.listeners = make(map[string][]HandlerFunc)
	bus.wildcardListeners = make([]HandlerFunc, 0)
	return bus
}

func (b *InProcBus) Dispatch(msg Msg) error {
	var msgName = reflect.TypeOf(msg).Elem().Name()

	var handler = b.handlers[msgName]
	if handler == nil {
		return fmt.Errorf("handler not found for %s", msgName)
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

func (b *InProcBus) Publish(msg Msg) error {
	var msgName = reflect.TypeOf(msg).Elem().Name()
	var listeners = b.listeners[msgName]

	var params = make([]reflect.Value, 1)
	params[0] = reflect.ValueOf(msg)

	for _, listenerHandler := range listeners {
		ret := reflect.ValueOf(listenerHandler).Call(params)
		err := ret[0].Interface()
		if err != nil {
			return err.(error)
		}
	}

	for _, listenerHandler := range b.wildcardListeners {
		ret := reflect.ValueOf(listenerHandler).Call(params)
		err := ret[0].Interface()
		if err != nil {
			return err.(error)
		}
	}

	return nil
}

func (b *InProcBus) AddWildcardListener(handler HandlerFunc) {
	b.wildcardListeners = append(b.wildcardListeners, handler)
}

func (b *InProcBus) AddHandler(handler HandlerFunc) {
	handlerType := reflect.TypeOf(handler)
	queryTypeName := handlerType.In(0).Elem().Name()
	b.handlers[queryTypeName] = handler
}

func (b *InProcBus) AddEventListener(handler HandlerFunc) {
	handlerType := reflect.TypeOf(handler)
	eventName := handlerType.In(0).Elem().Name()
	_, exists := b.listeners[eventName]
	if !exists {
		b.listeners[eventName] = make([]HandlerFunc, 0)
	}
	b.listeners[eventName] = append(b.listeners[eventName], handler)
}

// Package level functions
func AddHandler(implName string, handler HandlerFunc) {
	globalBus.AddHandler(handler)
}

// Package level functions
func AddEventListener(handler HandlerFunc) {
	globalBus.AddEventListener(handler)
}

func AddWildcardListener(handler HandlerFunc) {
	globalBus.AddWildcardListener(handler)
}

func Dispatch(msg Msg) error {
	return globalBus.Dispatch(msg)
}

func Publish(msg Msg) error {
	return globalBus.Publish(msg)
}

func ClearBusHandlers() {
	globalBus = New()
}
