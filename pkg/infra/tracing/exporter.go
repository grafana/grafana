package tracing

import tracesdk "go.opentelemetry.io/otel/sdk/trace"

type ExporterConfig interface {
	ToExporter() (tracesdk.SpanExporter, error)
}
