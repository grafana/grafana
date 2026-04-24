package install

import (
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/trace"
)

func getTracer() trace.Tracer {
	return otel.GetTracerProvider().Tracer("plugins-app.install")
}
