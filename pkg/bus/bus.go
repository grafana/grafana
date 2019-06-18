package bus

import (
	"context"
	"errors"
	"reflect"
)

// HandlerFunc defines a handler function interface.
type HandlerFunc interface{}

// CtxHandlerFunc defines a context handler function.
type CtxHandlerFunc func()

// Msg defines a message interface.
type Msg interface{}

// ErrHandlerNotFound defines an error if a handler is not found
var ErrHandlerNotFound = errors.New("handler not found")

// TransactionManager defines a transaction interface
type TransactionManager interface {
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

// Bus type defines the bus interface structure
type Bus interface {
	Dispatch(msg Msg) error
	DispatchCtx(ctx context.Context, msg Msg) error
	Publish(msg Msg) error

	// InTransaction starts a transaction and store it in the context.
	// The caller can then pass a function with multiple DispatchCtx calls that
	// all will be executed in the same transaction. InTransaction will rollback if the
	// callback returns an error.
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error

	AddHandler(handler HandlerFunc)
	AddHandlerCtx(handler HandlerFunc)
	AddEventListener(handler HandlerFunc)
	AddWildcardListener(handler HandlerFunc)

	// SetTransactionManager allows the user to replace the internal
	// noop TransactionManager that is responsible for manageing
	// transactions in `InTransaction`
	SetTransactionManager(tm TransactionManager)
}

// InTransaction defines an in transaction function
func (b *InProcBus) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return b.txMng.InTransaction(ctx, fn)
}

// InProcBus defines the bus structure
type InProcBus struct {
	handlers          map[string]HandlerFunc
	handlersWithCtx   map[string]HandlerFunc
	listeners         map[string][]HandlerFunc
	wildcardListeners []HandlerFunc
	txMng             TransactionManager
}

// temp stuff, not sure how to handle bus instance, and init yet
var globalBus = New()

// New initialize the bus
func New() Bus {
	bus := &InProcBus{}
	bus.handlers = make(map[string]HandlerFunc)
	bus.handlersWithCtx = make(map[string]HandlerFunc)
	bus.listeners = make(map[string][]HandlerFunc)
	bus.wildcardListeners = make([]HandlerFunc, 0)
	bus.txMng = &noopTransactionManager{}

	return bus
}

// Want to get rid of global bus
func GetBus() Bus {
	return globalBus
}

// SetTransactionManager function assign a transaction manager to the bus.
func (b *InProcBus) SetTransactionManager(tm TransactionManager) {
	b.txMng = tm
}

// DispatchCtx function dispatch a message to the bus context.
func (b *InProcBus) DispatchCtx(ctx context.Context, msg Msg) error {
	var msgName = reflect.TypeOf(msg).Elem().Name()

	var handler = b.handlersWithCtx[msgName]
	if handler == nil {
		return ErrHandlerNotFound
	}

	var params = []reflect.Value{}
	params = append(params, reflect.ValueOf(ctx))
	params = append(params, reflect.ValueOf(msg))

	ret := reflect.ValueOf(handler).Call(params)
	err := ret[0].Interface()
	if err == nil {
		return nil
	}
	return err.(error)
}

// Dispatch function dispatch a message to the bus.
func (b *InProcBus) Dispatch(msg Msg) error {
	var msgName = reflect.TypeOf(msg).Elem().Name()

	var handler = b.handlersWithCtx[msgName]
	withCtx := true

	if handler == nil {
		withCtx = false
		handler = b.handlers[msgName]
	}

	if handler == nil {
		return ErrHandlerNotFound
	}

	var params = []reflect.Value{}
	if withCtx {
		params = append(params, reflect.ValueOf(context.Background()))
	}
	params = append(params, reflect.ValueOf(msg))

	ret := reflect.ValueOf(handler).Call(params)
	err := ret[0].Interface()
	if err == nil {
		return nil
	}
	return err.(error)
}

// Publish function publish a message to the bus listener.
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

func (b *InProcBus) AddHandlerCtx(handler HandlerFunc) {
	handlerType := reflect.TypeOf(handler)
	queryTypeName := handlerType.In(1).Elem().Name()
	b.handlersWithCtx[queryTypeName] = handler
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

// AddHandler attach a handler function to the global bus
// Package level function
func AddHandler(implName string, handler HandlerFunc) {
	globalBus.AddHandler(handler)
}

// AddHandlerCtx attach a handler function to the global bus context
// Package level functions
func AddHandlerCtx(implName string, handler HandlerFunc) {
	globalBus.AddHandlerCtx(handler)
}

// AddEventListener attach a handler function to the event listener
// Package level functions
func AddEventListener(handler HandlerFunc) {
	globalBus.AddEventListener(handler)
}

// AddWildcardListener attach a handler function to the wildcard listener
func AddWildcardListener(handler HandlerFunc) {
	globalBus.AddWildcardListener(handler)
}

func Dispatch(msg Msg) error {
	return globalBus.Dispatch(msg)
}

func DispatchCtx(ctx context.Context, msg Msg) error {
	return globalBus.DispatchCtx(ctx, msg)
}

func Publish(msg Msg) error {
	return globalBus.Publish(msg)
}

// InTransaction starts a transaction and store it in the context.
// The caller can then pass a function with multiple DispatchCtx calls that
// all will be executed in the same transaction. InTransaction will rollback if the
// callback returns an error.
func InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return globalBus.InTransaction(ctx, fn)
}

func ClearBusHandlers() {
	globalBus = New()
}

type noopTransactionManager struct{}

func (*noopTransactionManager) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}
