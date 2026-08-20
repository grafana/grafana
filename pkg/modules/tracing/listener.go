package tracing

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

var _ services.Listener = (*Listener)(nil)

// Listener implements dskit's services.Listener interface to add comprehensive tracing
// for service state transitions. Startup and shutdown get a parent span each. Nothing
// spans the running state: it lasts as long as the process, so its span would only be
// exported at exit, orphaning everything beneath it until then.
type Listener struct {
	serviceName string

	ctx        context.Context
	parentSpan trace.Span
	stateSpan  trace.Span

	shutdownMu  sync.Mutex
	shutdownCtx context.Context

	done     chan struct{}
	doneOnce sync.Once
}

// NewListener creates a new tracing listener for the given service.
func NewListener(ctx context.Context, serviceName string) *Listener {
	l := &Listener{
		ctx:         ctx,
		serviceName: serviceName,
		done:        make(chan struct{}),
	}
	return l
}

// Done is closed once the listener has closed its last span.
func (l *Listener) Done() <-chan struct{} {
	return l.done
}

func (l *Listener) markDone() {
	l.doneOnce.Do(func() { close(l.done) })
}

// SetShutdownContext sets the parent for the spans recorded from Stopping onwards.
// Set it before the service can enter Stopping, or those spans start their own trace.
func (l *Listener) SetShutdownContext(ctx context.Context) {
	l.shutdownMu.Lock()
	defer l.shutdownMu.Unlock()
	l.shutdownCtx = ctx
}

func (l *Listener) shutdownContext() context.Context {
	l.shutdownMu.Lock()
	defer l.shutdownMu.Unlock()
	if l.shutdownCtx == nil {
		return context.Background()
	}
	return l.shutdownCtx
}

// Starting is called when the service transitions from NEW to STARTING.
func (l *Listener) Starting() {
	spanCtx, span := tracing.Start(l.ctx, l.serviceName)
	l.ctx = spanCtx
	l.parentSpan = span

	l.startSpan(services.Starting, nil)
}

// Running is called when the service transitions from STARTING to RUNNING, and
// closes the startup spans.
func (l *Listener) Running() {
	l.endSpan(nil)
	l.endParentSpan(services.Running, nil)
}

// Stopping is called when the service transitions to the STOPPING state, and
// opens the shutdown spans.
func (l *Listener) Stopping(from services.State) {
	l.endSpan(nil)
	// A shutdown landing mid-startup skips Running, leaving the startup span open.
	l.endParentSpan(from, nil)

	spanCtx, span := tracing.StartRoot(l.shutdownContext(), l.serviceName)
	l.ctx = spanCtx
	l.parentSpan = span

	l.startSpan(services.Stopping, &from)
}

// Terminated is called when the service transitions to the TERMINATED state.
func (l *Listener) Terminated(from services.State) {
	defer l.markDone()
	l.endSpan(nil)
	l.endParentSpan(from, nil)
}

// Failed is called when the service transitions to the FAILED state.
func (l *Listener) Failed(from services.State, failure error) {
	defer l.markDone()
	l.endSpan(failure)
	l.endParentSpan(from, failure)
}

// startSpan creates and stores a span for the given state
func (l *Listener) startSpan(toState services.State, fromState *services.State) {
	spanName := fmt.Sprintf("%s Service", toState.String())
	attributes := []attribute.KeyValue{
		attribute.String("grafana.service.name", l.serviceName),
	}
	if fromState != nil {
		attributes = append(attributes, attribute.String("modules.tracing.from_state", fromState.String()))
	}
	_, span := tracing.Start(l.ctx, spanName, attributes...)
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
