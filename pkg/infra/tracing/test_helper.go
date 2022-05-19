package tracing

func InitializeTracerForTest() (Tracer, error) {
	ots := &Opentelemetry{
		enabled: "jaeger",
	}
	err := ots.initOpentelemetryTracer()
	if err != nil {
		return ots, err
	}
	return ots, err
}

func InitializeForBus() Tracer {
	ots := &Opentelemetry{
		enabled: "jaeger",
	}
	_ = ots.initOpentelemetryTracer()
	return ots
}
