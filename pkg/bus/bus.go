package bus

import (
	"context"
	"errors"
	"fmt"
	"reflect"

	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/tracing"
)

// HandlerFunc defines a handler function interface.
type HandlerFunc interface{}

// Msg defines a message interface.
type Msg interface{}

// ErrHandlerNotFound defines an error if a handler is not found.
var ErrHandlerNotFound = errors.New("handler not found")

// Bus type defines the bus interface structure.
type Bus interface {
	Publish(ctx context.Context, msg Msg) error
	AddEventListener(handler HandlerFunc)
}

// InProcBus defines the bus structure.
type InProcBus struct {
	listeners map[string][]HandlerFunc
	tracer    tracing.Tracer
}

func ProvideBus(tracer tracing.Tracer) *InProcBus {
	return &InProcBus{
		listeners: make(map[string][]HandlerFunc),
		tracer:    tracer,
	}
}

// Publish function publish a message to the bus listener.
func (b *InProcBus) Publish(ctx context.Context, msg Msg) error {
	var msgName = reflect.TypeOf(msg).Elem().Name()

	var params = []reflect.Value{}
	if listeners, exists := b.listeners[msgName]; exists {
		params = append(params, reflect.ValueOf(ctx))
		params = append(params, reflect.ValueOf(msg))
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
	_, exists := b.listeners[eventName]
	if !exists {
		b.listeners[eventName] = make([]HandlerFunc, 0)
	}
	b.listeners[eventName] = append(b.listeners[eventName], handler)
}
