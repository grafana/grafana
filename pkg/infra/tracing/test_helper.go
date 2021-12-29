package tracing

func InitializeTracerForTest() (TracerService, error) {
	ots := &Opentelemetry{}
	err := ots.initOpentelemetryTracer()
	if err != nil {
		return ots, err
	}
	return ots, err
}

func InitializeForBus() TracerService {
	ots := &Opentelemetry{}
	_ = ots.initOpentelemetryTracer()
	return ots
}
