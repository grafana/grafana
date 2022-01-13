package tracing

func InitializeTracerForTest() (Tracer, error) {
	ots := &Opentelemetry{}
	err := ots.initOpentelemetryTracer()
	if err != nil {
		return ots, err
	}
	return ots, err
}

func InitializeForBus() Tracer {
	ots := &Opentelemetry{}
	_ = ots.initOpentelemetryTracer()
	return ots
}
