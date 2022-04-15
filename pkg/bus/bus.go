package bus

import (
	"context"
	"errors"
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/setting"
	"go.opentelemetry.io/otel/attribute"
)

// HandlerFunc defines a handler function interface.
type HandlerFunc interface{}

// Msg defines a message interface.
type Msg interface{}

// ErrHandlerNotFound defines an error if a handler is not found
var ErrHandlerNotFound = errors.New("handler not found")

// Bus type defines the bus interface structure
type Bus interface {
	Publish(ctx context.Context, msg Msg) error
	AddEventListener(handler HandlerFunc)
}

// InProcBus defines the bus structure
type InProcBus struct {
	logger           log.Logger
	listeners        map[string][]HandlerFunc
	listenersWithCtx map[string][]HandlerFunc
	tracer           tracing.Tracer
}

func ProvideBus(tracer tracing.Tracer) *InProcBus {
	globalBus.tracer = tracer
	return globalBus
}

// temp stuff, not sure how to handle bus instance, and init yet
var globalBus = New()

// New initialize the bus
func New() *InProcBus {
	bus := &InProcBus{
		logger:           log.New("bus"),
		listeners:        make(map[string][]HandlerFunc),
		listenersWithCtx: make(map[string][]HandlerFunc),
	}
	bus.tracer = tracing.InitializeForBus()
	return bus
}

// PublishCtx function publish a message to the bus listener.
func (b *InProcBus) Publish(ctx context.Context, msg Msg) error {
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

func (b *InProcBus) AddEventListener(handler HandlerFunc) {
	handlerType := reflect.TypeOf(handler)
	eventName := handlerType.In(1).Elem().Name()
	_, exists := b.listenersWithCtx[eventName]
	if !exists {
		b.listenersWithCtx[eventName] = make([]HandlerFunc, 0)
	}
	b.listenersWithCtx[eventName] = append(b.listenersWithCtx[eventName], handler)
}

// AddEventListenerCtx attaches a handler function to the event listener.
// Package level function.
func AddEventListener(handler HandlerFunc) {
	globalBus.AddEventListener(handler)
}

func Publish(ctx context.Context, msg Msg) error {
	return globalBus.Publish(ctx, msg)
}
