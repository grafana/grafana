package annotation

import "go.opentelemetry.io/otel"

// tracer is the package-level tracer for all annotation app tracing.
var tracer = otel.Tracer("github.com/grafana/grafana/pkg/registry/apps/annotation")
