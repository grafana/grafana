package tracing

import (
	"context"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/semconv"
	"go.opentelemetry.io/otel/trace"
)

var _ services.NamedService = &ServiceTracer{}

// ServiceTracer wraps service.NamedService and adds tracing.
// Currently it is limited to the starting -> running state transition.
type ServiceTracer struct {
	services.NamedService
	tracer trace.Tracer
}

// NewServiceTracer creates a new ServiceTracer.
func NewServiceTracer(tracerProvider trace.TracerProvider, service services.NamedService) *ServiceTracer {
	tracer := tracerProvider.Tracer("pkg/modules/tracing")
	return &ServiceTracer{NamedService: service, tracer: tracer}
}

func (s *ServiceTracer) StartAsync(ctx context.Context) error {
	spanCtx, span := s.tracer.Start(ctx, "Service Start", trace.WithAttributes(semconv.GrafanaServiceName(s.ServiceName())))
	go func() {
		if err := s.AwaitRunning(spanCtx); err != nil {
			span.RecordError(err)
		}
		span.End()
	}()
	return s.NamedService.StartAsync(ctx)
}
