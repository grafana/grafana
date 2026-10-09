package service

import (
	"context"

	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Keep the existing tracer identity while moving ownership.
var tracer = otel.Tracer("github.com/grafana/grafana/pkg/storage/unified/resource")

const readChunkSize = 10

type noopDiagnostics struct{}

func (*noopDiagnostics) IsHealthy(context.Context, *resourcepb.HealthCheckRequest) (*resourcepb.HealthCheckResponse, error) {
	return &resourcepb.HealthCheckResponse{Status: resourcepb.HealthCheckResponse_SERVING}, nil
}
