package mock

import (
	"github.com/grafana/grafana/pkg/bus"
	"github.com/grafana/grafana/pkg/infra/tracing"
)

func New() bus.Bus {
	tracer, _ := tracing.InitializeTracerForTest()
	return bus.ProvideBus(tracer)
}
