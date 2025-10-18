package tracing

import (
	"context"
	"fmt"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/semconv"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var _ services.Listener = (*Listener)(nil)

// Listener implements dskit's services.Listener interface to add comprehensive tracing
// for service state transitions. It creates individual spans for each service state
// (Starting, Running, Stopping) to track their durations, providing detailed timing
// information about service lifecycle performance.
type Listener struct {
	serviceName string

	ctx        context.Context
	parentSpan trace.Span
	stateSpan  trace.Span
}

// NewListener creates a new tracing listener for the given service.
func NewListener(ctx context.Context, serviceName string) *Listener {
	l := &Listener{
		ctx:         ctx,
		serviceName: serviceName,
	}
	return l
}

// Starting is called when the service transitions from NEW to STARTING.
func (l *Listener) Starting() {
	// Create the parent span when the service starts
	spanCtx, span := tracing.Start(l.ctx, l.serviceName)
	l.ctx = spanCtx
	l.parentSpan = span

	l.startSpan(services.Starting, nil)
}

// Running is called when the service transitions from STARTING to RUNNING.
func (l *Listener) Running() {
	l.endSpan(nil)
	l.startSpan(services.Running, nil)
}

// Stopping is called when the service transitions to the STOPPING state.
func (l *Listener) Stopping(from services.State) {
	l.endSpan(nil)
	l.startSpan(services.Stopping, &from)
}

// Terminated is called when the service transitions to the TERMINATED state.
func (l *Listener) Terminated(from services.State) {
	l.endSpan(nil)
	l.endParentSpan(from, nil)
}

// Failed is called when the service transitions to the FAILED state.
func (l *Listener) Failed(from services.State, failure error) {
	l.endSpan(failure)
	l.endParentSpan(from, failure)
}

// startSpan creates and stores a span for the given state
func (l *Listener) startSpan(toState services.State, fromState *services.State) {
	spanName := fmt.Sprintf("%s Service", toState.String())
	_, span := tracing.Start(l.ctx, spanName, semconv.GrafanaServiceName(l.serviceName))
	attributes := []attribute.KeyValue{
		semconv.GrafanaServiceName(l.serviceName),
	}
	if fromState != nil {
		attributes = append(attributes, attribute.String("modules.tracing.from_state", fromState.String()))
	}
	span.SetAttributes(attributes...)
	l.stateSpan = span
}

// endSpan safely ends and removes a span for the given state
// If err is provided, it will be recorded on the span before ending
func (l *Listener) endSpan(err error) {
	if l.stateSpan == nil || !l.stateSpan.IsRecording() {
		return
	}
	if err != nil {
		l.stateSpan.SetStatus(codes.Error, err.Error())
		l.stateSpan.RecordError(err)
	} else {
		l.stateSpan.SetStatus(codes.Ok, "")
	}
	l.stateSpan.End()
	l.stateSpan = nil
}

// endParentSpan safely ends and removes the parent span
// If err is provided, it will be recorded on the parent span before ending
func (l *Listener) endParentSpan(from services.State, err error) {
	if l.parentSpan == nil || !l.parentSpan.IsRecording() {
		return
	}
	l.parentSpan.SetAttributes(attribute.String("modules.tracing.final_state", from.String()))
	if err != nil {
		l.parentSpan.SetStatus(codes.Error, err.Error())
		l.parentSpan.RecordError(err)
	} else {
		l.parentSpan.SetStatus(codes.Ok, "")
	}
	l.parentSpan.End()
	l.parentSpan = nil
}
