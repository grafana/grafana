package tracing

import (
	"context"

	otelpyroscope "github.com/grafana/otel-profiling-go"
	trace "go.opentelemetry.io/otel/trace"
)

type profilingTracerProvider struct {
	trace.TracerProvider
	wrappedTp tracerProvider
}

func NewProfilingTracerProvider(tp tracerProvider) tracerProvider {
	return &profilingTracerProvider{
		TracerProvider: otelpyroscope.NewTracerProvider(tp),
		wrappedTp:      tp,
	}
}

func (tp *profilingTracerProvider) Shutdown(ctx context.Context) error {
	return tp.wrappedTp.Shutdown(ctx)
}
