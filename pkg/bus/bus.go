package bus

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"sync"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"go.opentelemetry.io/otel/attribute"
)

// HandlerFunc defines a handler function interface. Implementations of
// HandlerFunc are expected to have a signature shaped like:
// func Handler(ctx context.Context, msg MsgType) error
// Where MsgType is any type. When a message with type MsgType is sent via a
// bus's Dispatch or Publish methods, the bus finds the appropriate handler by
// looking at the type of the 'msg' argument.
type HandlerFunc interface{}

// Msg defines a message interface. The concreate type of a Msg is used to find
// appropriate handlers in the bus.
type Msg interface{}

// ErrHandlerNotFound defines an error if a handler is not found
var ErrHandlerNotFound = errors.New("handler not found")

// TransactionManager defines a transaction interface
type TransactionManager interface {
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
}

// Bus is a message bus that sends messages (of type Msg) to registered
// HandlerFuncs. It supports two call models: Dispatch and Publish. Both
// Dispatch and Publish are synchronous calls - they return only after all
// handlers have processed a given message.
//
// In the Dispatch model, exactly one HandlerFunc can handle messages for
// Messages sent by calling Dispatch() are forwarded to the HandlerFunc
// registered for the message's concrete type. Each call to AddHandler replaces
// the existing handler for a given Msg type. Dispatch returns the error
// returned by the HandlerFunc
//
// In the Publish model, multiple listeners may process a single message, which
// functions like an Event in common event buses. Publish processes listeners
// serially and returns the first non-nil error from a listener. If any
// listener errors, subsequent listeners will not be called.
type Bus interface {
	Dispatch(ctx context.Context, msg Msg) error

	Publish(ctx context.Context, msg Msg) error

	// InTransaction runs the provided fn with the TrasnactionManager set by SetTransactionManager.
	// The caller can pass a function with multiple Dispatch calls that
	// all will be executed in the same transaction. InTransaction will rollback if the
	// callback returns an error.
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error

	SetHandler(handler HandlerFunc)

	// Adds an event listener.
	AddEventListener(handler HandlerFunc)

	// SetTransactionManager allows the user to replace the internal
	// noop TransactionManager that is responsible for managing
	// transactions in `InTransaction`
	SetTransactionManager(tm TransactionManager)
}

// InProcBus defines the bus structure
type InProcBus struct {
	sync.Mutex

	logger    log.Logger
	handlers  map[string]HandlerFunc
	listeners map[string][]HandlerFunc
	txMng     TransactionManager
	tracer    tracing.Tracer
}

func ProvideBus(tracer tracing.Tracer) *InProcBus {
	globalBus.tracer = tracer
	return globalBus
}

// InTransaction defines an in transaction function
func (b *InProcBus) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return b.txMng.InTransaction(ctx, fn)
}

// temp stuff, not sure how to handle bus instance, and init yet
var globalBus = New()

// New initialize the bus
func New() *InProcBus {
	bus := &InProcBus{
		logger:    log.New("bus"),
		handlers:  make(map[string]HandlerFunc),
		listeners: make(map[string][]HandlerFunc),
		txMng:     &noopTransactionManager{},
	}
	bus.tracer = tracing.InitializeForBus()
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

// Dispatches a message to the bus context.
func (b *InProcBus) Dispatch(ctx context.Context, msg Msg) error {
	var msgName = reflect.TypeOf(msg).Elem().Name()

	ctx, span := b.tracer.Start(ctx, "bus - "+msgName)
	defer span.End()

	span.SetAttributes("msg", msgName, attribute.Key("msg").String(msgName))

	handler, err := func() (HandlerFunc, error) {
		b.Lock()
		defer b.Unlock()

		var handler = b.handlers[msgName]
		if handler == nil {
			return nil, ErrHandlerNotFound
		}
		return handler, nil
	}()

	if err != nil {
		return err
	}

	var params = []reflect.Value{}
	params = append(params, reflect.ValueOf(ctx))
	params = append(params, reflect.ValueOf(msg))

	ret := reflect.ValueOf(handler).Call(params)
	errI := ret[0].Interface()
	if errI == nil {
		return nil
	}
	return errI.(error)
}

// Publishes a message to the bus listener.
func (b *InProcBus) Publish(ctx context.Context, msg Msg) error {
	var msgName = reflect.TypeOf(msg).Elem().Name()

	var params = []reflect.Value{}
	listeners := func() []HandlerFunc {
		b.Lock()
		defer b.Unlock()

		listeners, found := b.listeners[msgName]
		if !found {
			return nil
		}

		params = append(params, reflect.ValueOf(ctx))
		params = append(params, reflect.ValueOf(msg))
		// Copy the listeners so we don't retain a reference to the mutable slice in the map.
		retSlice := make([]HandlerFunc, len(listeners))
		copy(retSlice, listeners)
		return retSlice
	}()

	if err := callListeners(listeners, params); err != nil {
		return err
	}
	_, span := b.tracer.Start(ctx, "bus - "+msgName)
	defer span.End()

	span.SetAttributes("msg", msgName, attribute.Key("msg").String(msgName))

	return nil
}

func callListeners(listeners []HandlerFunc, params []reflect.Value) error {
	for _, listenerHandler := range listeners {
		ret := reflect.ValueOf(listenerHandler).Call(params)
		e := ret[0].Interface()
		if e != nil {
			err, ok := e.(error)
			if ok {
				return err
			}
			return fmt.Errorf("expected listener to return an error, got '%T'", e)
		}
	}
	return nil
}

func (b *InProcBus) SetHandler(handler HandlerFunc) {
	b.Lock()
	defer b.Unlock()

	handlerType := reflect.TypeOf(handler)
	queryTypeName := handlerType.In(1).Elem().Name()
	b.handlers[queryTypeName] = handler
}

// GetHandlerCtx returns the handler function for the given struct name.
func (b *InProcBus) GetHandlerCtx(name string) HandlerFunc {
	b.Lock()
	defer b.Unlock()

	return b.handlers[name]
}

func (b *InProcBus) AddEventListener(handler HandlerFunc) {
	handlerType := reflect.TypeOf(handler)
	eventName := handlerType.In(1).Elem().Name()

	b.Lock()
	defer b.Unlock()

	_, exists := b.listeners[eventName]
	if !exists {
		b.listeners[eventName] = make([]HandlerFunc, 0)
	}
	b.listeners[eventName] = append(b.listeners[eventName], handler)
}

// SetHandler attaches a handler function to the global bus context.
// Package level function.
func SetHandler(implName string, handler HandlerFunc) {
	globalBus.SetHandler(handler)
}

// AddEventListenerCtx attaches a handler function to the event listener.
// Package level function.
func AddEventListener(handler HandlerFunc) {
	globalBus.AddEventListener(handler)
}

func Dispatch(ctx context.Context, msg Msg) error {
	return globalBus.Dispatch(ctx, msg)
}

func Publish(ctx context.Context, msg Msg) error {
	return globalBus.Publish(ctx, msg)
}

func GetHandlerCtx(name string) HandlerFunc {
	return globalBus.GetHandlerCtx(name)
}

func ClearBusHandlers() {
	globalBus = New()
}

type noopTransactionManager struct{}

func (*noopTransactionManager) InTransaction(ctx context.Context, fn func(ctx context.Context) error) error {
	return fn(ctx)
}
