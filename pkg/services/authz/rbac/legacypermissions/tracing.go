package legacypermissions

import (
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

func endPermissionSpan(span trace.Span, err error) {
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "permission operation failed")
	}
	span.End()
}
