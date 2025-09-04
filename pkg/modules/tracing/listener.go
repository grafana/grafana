package tracing

import (
	"context"
	"fmt"
	"sync"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/semconv"
	"go.opentelemetry.io/otel/trace"
)

var _ services.Listener = (*Listener)(nil)

// Listener implements dskit's services.Listener interface to add comprehensive tracing
// for service state transitions. It creates individual spans for each service state
// (New,Starting, Running, Stopping) to track their durations, providing detailed timing
// information about service lifecycle performance.
type Listener struct {
	ctx         context.Context
	serviceName string

	// Active spans for tracking state durations
	mu         sync.RWMutex
	parentSpan trace.Span
	spans      map[services.State]trace.Span
}

// NewListener creates a new tracing listener for the given service.
func NewListener(ctx context.Context, serviceName string) *Listener {
	spanCtx, span := tracing.Start(ctx, serviceName)
	l := &Listener{
		ctx:         spanCtx,
		parentSpan:  span,
		serviceName: serviceName,
		spans:       make(map[services.State]trace.Span),
	}
	l.startSpan(services.New)
	return l
}

// Starting is called when the service transitions from NEW to STARTING.
func (l *Listener) Starting() {
	l.endSpan(services.New, nil)
	l.startSpan(services.Starting)
}

// Running is called when the service transitions from STARTING to RUNNING.
func (l *Listener) Running() {
	l.endSpan(services.Starting, nil)
	l.startSpan(services.Running)
}

// Stopping is called when the service transitions to the STOPPING state.
func (l *Listener) Stopping(from services.State) {
	l.endSpan(from, nil)
	l.startSpan(services.Stopping)
}

// Terminated is called when the service transitions to the TERMINATED state.
func (l *Listener) Terminated(from services.State) {
	l.endSpan(from, nil)
	l.endAllSpans() // Clean up any remaining spans
}

// Failed is called when the service transitions to the FAILED state.
func (l *Listener) Failed(from services.State, failure error) {
	l.endSpan(from, failure)
	l.endAllSpans() // Clean up any remaining spans
}

// startSpan creates and stores a span for the given state
func (l *Listener) startSpan(state services.State) {
	spanName := fmt.Sprintf("%s Service", state.String())
	_, span := tracing.Start(l.ctx, spanName, semconv.GrafanaServiceName(l.serviceName))

	l.mu.Lock()
	l.spans[state] = span
	l.mu.Unlock()
}

// endSpan safely ends and removes a span for the given state
// If err is provided, it will be recorded on the span before ending
func (l *Listener) endSpan(state services.State, err error) {
	l.mu.Lock()
	defer l.mu.Unlock()

	span, exists := l.spans[state]
	if !exists || !span.IsRecording() {
		return
	}
	if err != nil {
		span.RecordError(err)
	}
	span.End()
	delete(l.spans, state)
}

// endAllSpans ensures all active spans are properly closed
func (l *Listener) endAllSpans() {
	l.mu.Lock()
	defer l.mu.Unlock()

	for state, span := range l.spans {
		if span.IsRecording() {
			span.End()
		}
		delete(l.spans, state)
	}
	l.parentSpan.End()
}
