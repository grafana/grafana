package tracing

import (
	"context"

	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
)

type OTLPExporterConfig struct {
	ExporterConfig
	Insecure       bool     `ini:"insecure"`
	LegacyEndpoint string   `ini:"address"`
	Endpoint       string   `ini:"endpoint"`
	Propagation    []string `ini:"propagation"`
}

func (e OTLPExporterConfig) ToExporter() (tracesdk.SpanExporter, error) {
	// silently fallback to legacy endpoint
	endpoint := e.LegacyEndpoint
	if endpoint == "" {
		endpoint = e.Endpoint
	}

	options := make([]otlptracegrpc.Option, 0)
	options = append(options, otlptracegrpc.WithEndpoint(endpoint))

	if e.Insecure {
		options = append(options, otlptracegrpc.WithInsecure())
	}

	client := otlptracegrpc.NewClient(options...)
	return otlptrace.New(context.Background(), client)
}
