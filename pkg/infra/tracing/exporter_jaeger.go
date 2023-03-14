package tracing

import (
	"go.opentelemetry.io/otel/exporters/jaeger"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
)

type JaegerExporterConfig struct {
	ExporterConfig
	Address     string   `ini:"address"`
	Propagation []string `ini:"propagation"`
}

func (e JaegerExporterConfig) ToExporter() (tracesdk.SpanExporter, error) {
	return jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(e.Address)))
}
