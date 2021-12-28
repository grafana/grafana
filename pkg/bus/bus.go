package bus

import (
	"context"
	"errors"
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/opentracing/opentracing-go"
)

// HandlerFunc defines a handler function interface.
type HandlerFunc interface{}

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
	Dispatch(ctx context.Context, msg Msg) error

	PublishCtx(ctx context.Context, msg Msg) error

	// InTransaction starts a transaction and store it in the context.
	// The caller can then pass a function with multiple DispatchCtx calls that
	// all will be executed in the same transaction. InTransaction will rollback if the
	// callback returns an error.
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error

	AddHandler(handler HandlerFunc)

	AddEventListenerCtx(handler HandlerFunc)

	// SetTransactionManager allows the user to replace the internal
	// noop TransactionManager that is responsible for managing
	// transactions in `InTransaction`
	SetTransactionManager(tm TransactionManager)
}

// InProcBus defines the bus structure
type InProcBus struct {
	logger           log.Logger
	handlers         map[string]HandlerFunc
	handlersWithCtx  map[string]HandlerFunc
	listeners        map[string][]HandlerFunc
	listenersWithCtx map[string][]HandlerFunc
	txMng            TransactionManager
}

func ProvideBus() *InProcBus {
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
	return &InProcBus{
		logger:           log.New("bus"),
		handlers:         make(map[string]HandlerFunc),
		handlersWithCtx:  make(map[string]HandlerFunc),
		listeners:        make(map[string][]HandlerFunc),
		listenersWithCtx: make(map[string][]HandlerFunc),
		txMng:            &noopTransactionManager{},
	}
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
func (b *InProcBus) Dispatch(ctx context.Context, msg Msg) error {
	var msgName = reflect.TypeOf(msg).Elem().Name()

	span, ctx := opentracing.StartSpanFromContext(ctx, "bus - "+msgName)
	defer span.Finish()

	span.SetTag("msg", msgName)

	withCtx := true
	var handler = b.handlersWithCtx[msgName]
	if handler == nil {
		withCtx = false
		handler = b.handlers[msgName]
		if handler == nil {
			return ErrHandlerNotFound
		}
	}

	var params = []reflect.Value{}
	if withCtx {
		params = append(params, reflect.ValueOf(ctx))
	} else if setting.Env == setting.Dev {
		b.logger.Warn("DispatchCtx called with message handler registered using AddHandler and should be changed to use AddHandler", "msgName", msgName)
	}
	params = append(params, reflect.ValueOf(msg))

	ret := reflect.ValueOf(handler).Call(params)
	err := ret[0].Interface()
	if err == nil {
		return nil
	}
	return err.(error)
}

// PublishCtx function publish a message to the bus listener.
func (b *InProcBus) PublishCtx(ctx context.Context, msg Msg) error {
	var msgName = reflect.TypeOf(msg).Elem().Name()

	var params = []reflect.Value{}
	if listeners, exists := b.listenersWithCtx[msgName]; exists {
		params = append(params, reflect.ValueOf(ctx))
		params = append(params, reflect.ValueOf(msg))
		if err := callListeners(listeners, params); err != nil {
			return err
		}
	}

	if listeners, exists := b.listeners[msgName]; exists {
		params = append(params, reflect.ValueOf(msg))
		if setting.Env == setting.Dev {
			b.logger.Warn("PublishCtx called with message listener registered using AddEventListener and should be changed to use AddEventListenerCtx", "msgName", msgName)
		}
		if err := callListeners(listeners, params); err != nil {
			return err
		}
	}

	span, _ := opentracing.StartSpanFromContext(ctx, "bus - "+msgName)
	defer span.Finish()

	span.SetTag("msg", msgName)

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

func (b *InProcBus) AddHandler(handler HandlerFunc) {
	handlerType := reflect.TypeOf(handler)
	queryTypeName := handlerType.In(1).Elem().Name()
	b.handlersWithCtx[queryTypeName] = handler
}

// GetHandlerCtx returns the handler function for the given struct name.
func (b *InProcBus) GetHandlerCtx(name string) HandlerFunc {
	return b.handlersWithCtx[name]
}

func (b *InProcBus) AddEventListenerCtx(handler HandlerFunc) {
	handlerType := reflect.TypeOf(handler)
	eventName := handlerType.In(1).Elem().Name()
	_, exists := b.listenersWithCtx[eventName]
	if !exists {
		b.listenersWithCtx[eventName] = make([]HandlerFunc, 0)
	}
	b.listenersWithCtx[eventName] = append(b.listenersWithCtx[eventName], handler)
}

// AddHandler attaches a handler function to the global bus context.
// Package level function.
func AddHandler(implName string, handler HandlerFunc) {
	globalBus.AddHandler(handler)
}

// AddEventListenerCtx attaches a handler function to the event listener.
// Package level function.
func AddEventListenerCtx(handler HandlerFunc) {
	globalBus.AddEventListenerCtx(handler)
}

func Dispatch(ctx context.Context, msg Msg) error {
	return globalBus.Dispatch(ctx, msg)
}

func PublishCtx(ctx context.Context, msg Msg) error {
	return globalBus.PublishCtx(ctx, msg)
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
