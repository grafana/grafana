package folders

import "go.opentelemetry.io/otel"

var tracer = otel.Tracer("github.com/grafana/grafana/pkg/registry/apis/folders")
