package tracing

import (
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
)

func InitializeTracerForTest() Tracer {
	exp := tracetest.NewInMemoryExporter()
	tp, _ := initTracerProvider(exp)
	otel.SetTracerProvider(tp)

	ots := &Opentelemetry{Propagation: "jaeger,w3c", tracerProvider: tp}
	_ = ots.initOpentelemetryTracer()
	return ots
}
