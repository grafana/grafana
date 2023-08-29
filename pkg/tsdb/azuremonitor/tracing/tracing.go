package tracing

import (
	"context"
	"net/http"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc/codes"
)

type Tracer interface {
	Run(context.Context) error
	Start(ctx context.Context, spanName string, opts ...trace.SpanStartOption) (context.Context, Span)
	Inject(context.Context, http.Header, Span)
}
type Span interface {
	End()
	SetAttributes(key string, value interface{}, kv attribute.KeyValue)
	SetName(name string)
	SetStatus(code codes.Code, description string)
	RecordError(err error, options ...trace.EventOption)
	AddEvents(keys []string, values []interface{})
	ContextWithSpan(ctx context.Context) context.Context
}
