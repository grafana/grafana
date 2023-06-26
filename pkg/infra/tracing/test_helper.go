package tracing

import (
	"context"
	"net/http"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
)

func InitializeTracerForTest() Tracer {
	exp := tracetest.NewInMemoryExporter()
	tp, _ := initTracerProvider(exp, "testing")
	otel.SetTracerProvider(tp)

	ots := &Opentelemetry{Propagation: "jaeger,w3c", tracerProvider: tp}
	_ = ots.initOpentelemetryTracer()
	return ots
}

type FakeSpan struct {
	Name string

	ended       bool
	Attributes  map[attribute.Key]attribute.Value
	StatusCode  codes.Code
	Description string
	Err         error
	Events      map[string]EventValue
}

func newFakeSpan(name string) *FakeSpan {
	return &FakeSpan{
		Name:       name,
		Attributes: map[attribute.Key]attribute.Value{},
		Events:     map[string]EventValue{},
	}
}

func (t *FakeSpan) End() {
	if t.ended {
		panic("End already called")
	}
	t.ended = true
}

func (t *FakeSpan) IsEnded() bool {
	return t.ended
}

func (t *FakeSpan) SetAttributes(key string, value interface{}, kv attribute.KeyValue) {
	if t.IsEnded() {
		panic("span already ended")
	}
	t.Attributes[kv.Key] = kv.Value
}

func (t *FakeSpan) SetName(name string) {
	if t.IsEnded() {
		panic("span already ended")
	}
	t.Name = name
}

func (t *FakeSpan) SetStatus(code codes.Code, description string) {
	if t.IsEnded() {
		panic("span already ended")
	}
	t.StatusCode = code
	t.Description = description
}

func (t *FakeSpan) RecordError(err error, options ...trace.EventOption) {
	if t.IsEnded() {
		panic("span already ended")
	}
	t.Err = err
}

func (t *FakeSpan) AddEvents(keys []string, values []EventValue) {
	if t.IsEnded() {
		panic("span already ended")
	}
	if len(keys) != len(values) {
		panic("different number of keys and values")
	}
	for i := 0; i < len(keys); i++ {
		t.Events[keys[i]] = values[i]
	}
}

func (t *FakeSpan) contextWithSpan(ctx context.Context) context.Context {
	return ctx
}

type FakeTracer struct {
	Spans []*FakeSpan
}

func (t *FakeTracer) Run(ctx context.Context) error {
	return nil
}

func (t *FakeTracer) Start(ctx context.Context, spanName string, opts ...trace.SpanStartOption) (context.Context, Span) {
	span := newFakeSpan(spanName)
	t.Spans = append(t.Spans, span)
	return ctx, span
}

func (t *FakeTracer) Inject(ctx context.Context, header http.Header, span Span) {
}

func NewFakeTracer() *FakeTracer {
	return &FakeTracer{Spans: []*FakeSpan{}}
}
