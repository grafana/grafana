package tracing

import (
	"context"
	"fmt"
	"strings"

	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
)

type OTLPHTTPExporterConfig struct {
	ExporterConfig
	Endpoint    string   `ini:"endpoint"`
	Headers     []string `ini:"headers"`
	Insecure    bool     `ini:"insecure"`
	Propagation []string `ini:"propagation"`
}

func (e OTLPHTTPExporterConfig) ToExporter() (tracesdk.SpanExporter, error) {
	headers := make(map[string]string)
	for _, header := range e.Headers {
		pair := strings.Split(header, ":")
		headers[strings.Trim(pair[0], " ")] = strings.Trim(pair[1], " ")
	}

	path := ""
	endpoint := e.Endpoint

	// edge-case: if the endpoint contains a path, we need to split it out to accomodate the special
	// needs of the go OTLP/HTTP exporter
	if strings.Contains(e.Endpoint, "/") {
		parts := strings.SplitN(e.Endpoint, "/", 2)
		endpoint = parts[0]
		path = fmt.Sprintf("/%s", parts[1])
	}

	options := make([]otlptracehttp.Option, 0)
	options = append(options, otlptracehttp.WithEndpoint(endpoint))
	options = append(options, otlptracehttp.WithHeaders(headers))

	if path != "" && path != "/" {
		path = fmt.Sprintf("%s/v1/traces", strings.TrimRight(path, "/"))
		options = append(options, otlptracehttp.WithURLPath(path))
	}

	if e.Insecure {
		options = append(options, otlptracehttp.WithInsecure())
	}

	client := otlptracehttp.NewClient(options...)

	return otlptrace.New(context.Background(), client)
}
