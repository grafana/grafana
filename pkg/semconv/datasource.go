package semconv

import "go.opentelemetry.io/otel/attribute"

const (
	// The UID of the datasource.
	//
	// Type: string
	// Required: No
	// Stability: stable
	// Examples: "abcdef-12345"
	GrafanaDatasourceUIDKey = attribute.Key("grafana.datasource.uid")
	// The type of the datasource.
	//
	// Type: string
	// Required: No
	// Stability: stable
	// Examples: "prometheus"
	GrafanaDatasourceTypeKey = attribute.Key("grafana.datasource.type")
	// The count of queries in a datasource query request.
	//
	// Type: int
	// Required: No
	// Stability: stable
	// Examples: 5
	GrafanaDatasourceRequestQueryCountKey = attribute.Key("grafana.datasource.request.query_count")
)

// GrafanaDatasourceUID generates an attribute with the UID of the datasource.
func GrafanaDatasourceUID(uid string) attribute.KeyValue {
	return GrafanaDatasourceUIDKey.String(uid)
}

// GrafanaDatasourceType generates an attribute with the type of the datasource.
func GrafanaDatasourceType(t string) attribute.KeyValue {
	return GrafanaDatasourceTypeKey.String(t)
}

// GrafanaDatasourceRequestQueryCount generates an attribute with the count of queries in a datasource query request.
func GrafanaDatasourceRequestQueryCount(count int) attribute.KeyValue {
	return GrafanaDatasourceRequestQueryCountKey.Int(count)
}
