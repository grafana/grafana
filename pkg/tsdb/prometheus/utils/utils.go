package utils

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"go.opentelemetry.io/otel/attribute"

	"github.com/grafana/grafana/pkg/infra/tracing"
)

// GetJsonData just gets the json in easier to work with type. It's used on multiple places which isn't super effective
// but only when creating a client which should not happen often anyway.
func GetJsonData(settings backend.DataSourceInstanceSettings) (map[string]interface{}, error) {
	var jsonData map[string]interface{}
	err := json.Unmarshal(settings.JSONData, &jsonData)
	if err != nil {
		return nil, fmt.Errorf("error unmarshalling JSONData: %w", err)
	}
	return jsonData, nil
}

type Attribute struct {
	Key   string
	Value interface{}
	Kv    attribute.KeyValue
}

// StartTrace setups a trace but does not panic if tracer is nil which helps with testing
func StartTrace(ctx context.Context, tracer tracing.Tracer, name string, attributes []Attribute) (context.Context, func()) {
	if tracer == nil {
		return ctx, func() {}
	}
	ctx, span := tracer.Start(ctx, name)
	for _, attr := range attributes {
		span.SetAttributes(attr.Key, attr.Value, attr.Kv)
	}
	return ctx, func() {
		span.End()
	}
}
