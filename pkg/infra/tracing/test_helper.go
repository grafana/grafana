package tracing

import (
	"go.opentelemetry.io/otel"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

type TracerForTestOption func(tp *tracesdk.TracerProvider)

func WithSpanProcessor(sp tracesdk.SpanProcessor) TracerForTestOption {
	return TracerForTestOption(func(tp *tracesdk.TracerProvider) {
		tp.RegisterSpanProcessor(sp)
	})
}

func InitializeTracerForTest(opts ...TracerForTestOption) Tracer {
	exp := tracetest.NewInMemoryExporter()
	tp, _ := initTracerProvider(exp, "grafana", "testing", tracesdk.AlwaysSample())

	for _, opt := range opts {
		opt(tp)
	}

	otel.SetTracerProvider(tp)

	cfg := NewEmptyTracingConfig()
	cfg.Propagation = "jaeger,w3c"
	ots := &TracingService{cfg: cfg, tracerProvider: tp}
	_ = ots.initOpentelemetryTracer()
	return ots
}
