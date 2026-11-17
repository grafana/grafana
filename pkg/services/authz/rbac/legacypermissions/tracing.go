package legacypermissions

import (
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

func endPermissionSpan(span trace.Span, err error) {
	if err != nil {
		// Database errors can contain query text or values. Keep the status generic.
		span.SetStatus(codes.Error, "permission operation failed")
	}
	span.End()
}
