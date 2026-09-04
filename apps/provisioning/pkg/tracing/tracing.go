// Package tracing lets the provisioning app carry an OpenTelemetry tracer on
// the context — the same way logging.FromContext carries a logger — so that
// downstream components can create spans without a *trace.Tracer being threaded
// through their constructors.
//
// The tracer is injected once at a small number of entrypoints via WithTracer;
// everything downstream reads it with FromContext (or the Start convenience).
package tracing

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
)

type tracerKey struct{}

const instrumentationScope = "github.com/grafana/grafana/apps/provisioning"

// noopTracer is the last-resort tracer when neither an injected tracer nor an
// active span is available, so callers can always Start a span safely (it
// simply produces a non-recording span).
var noopTracer = noop.NewTracerProvider().Tracer("")

// WithTracer stores tracer on the returned context. Call it at the few
// background entrypoints that start without an active span (operator run loops,
// job/sync workers); downstream code then resolves it with FromContext.
func WithTracer(ctx context.Context, tracer trace.Tracer) context.Context {
	if tracer == nil {
		return ctx
	}
	return context.WithValue(ctx, tracerKey{}, tracer)
}

// FromContext resolves a tracer from the context, preferring, in order:
//  1. a tracer injected via WithTracer (lets background entrypoints create root spans);
//  2. the provider of the active span on the context (covers request handling,
//     where middleware has already started a span, without needing WithTracer);
//  3. a no-op tracer.
func FromContext(ctx context.Context) trace.Tracer {
	if tracer, ok := ctx.Value(tracerKey{}).(trace.Tracer); ok && tracer != nil {
		return tracer
	}
	if span := trace.SpanFromContext(ctx); span.SpanContext().IsValid() {
		return span.TracerProvider().Tracer(instrumentationScope)
	}
	return noopTracer
}

// Start is shorthand for FromContext(ctx).Start(ctx, name, opts...). It mirrors
// trace.Tracer.Start so existing `someTracer.Start(ctx, name, opts...)` calls
// migrate to `tracing.Start(ctx, name, opts...)` unchanged.
func Start(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return FromContext(ctx).Start(ctx, name, opts...)
}

// Error records err on span, marks the span as failed, and returns err so
// callers can `return tracing.Error(span, err)`. Unlike the main module's
// pkg/infra/tracing.Error it does not add the errutil message_id attribute:
// this module cannot depend on the main grafana module.
func Error(span trace.Span, err error) error {
	span.SetStatus(codes.Error, err.Error())
	span.RecordError(err)
	return err
}

// Errorf wraps fmt.Errorf and records the error on span, like Error.
func Errorf(span trace.Span, format string, args ...any) error {
	return Error(span, fmt.Errorf(format, args...))
}
