package tracing

func InitializeTracerForTest() Tracer {
	ots := &OpenTelemetry{enabled: noopExporter}
	_ = ots.initOpenTelemetryTracer()
	return ots
}
