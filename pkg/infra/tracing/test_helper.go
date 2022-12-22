package tracing

func InitializeTracerForTest() Tracer {
	ots := &Opentelemetry{enabled: noopExporter}
	_ = ots.initOpentelemetryTracer()
	return ots
}
