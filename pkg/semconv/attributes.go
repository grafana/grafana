// Code generated from semantic convention specification. DO NOT EDIT.

package semconv

import "go.opentelemetry.io/otel/attribute"

// Describes Grafana datasource attributes.
const (
	// GrafanaDatasourceTypeKey is the attribute Key conforming to the
	// "grafana.datasource.type" semantic conventions. It represents the
	// datasource type.
	//
	// Type: string
	// RequirementLevel: Optional
	// Stability: stable
	// Examples: 'prometheus', 'loki', 'grafana-github-datasource'
	GrafanaDatasourceTypeKey = attribute.Key("grafana.datasource.type")

	// GrafanaDatasourceUidKey is the attribute Key conforming to the
	// "grafana.datasource.uid" semantic conventions. It represents the
	// datasource unique identifier.
	//
	// Type: string
	// RequirementLevel: Optional
	// Stability: stable
	// Examples: 'abcdefg-123456'
	GrafanaDatasourceUidKey = attribute.Key("grafana.datasource.uid")
)

// GrafanaDatasourceType returns an attribute KeyValue conforming to the
// "grafana.datasource.type" semantic conventions. It represents the datasource
// type.
func GrafanaDatasourceType(val string) attribute.KeyValue {
	return GrafanaDatasourceTypeKey.String(val)
}

// GrafanaDatasourceUid returns an attribute KeyValue conforming to the
// "grafana.datasource.uid" semantic conventions. It represents the datasource
// unique identifier.
func GrafanaDatasourceUid(val string) attribute.KeyValue {
	return GrafanaDatasourceUidKey.String(val)
}

// Describes Grafana data source request attributes.
const (
	// GrafanaDatasourceRequestQueryCountKey is the attribute Key conforming to
	// the "grafana.datasource.request.query_count" semantic conventions. It
	// represents the number of queries in the request.
	//
	// Type: int
	// RequirementLevel: Optional
	// Stability: stable
	// Examples: 3
	GrafanaDatasourceRequestQueryCountKey = attribute.Key("grafana.datasource.request.query_count")
)

// GrafanaDatasourceRequestQueryCount returns an attribute KeyValue
// conforming to the "grafana.datasource.request.query_count" semantic
// conventions. It represents the number of queries in the request.
func GrafanaDatasourceRequestQueryCount(val int) attribute.KeyValue {
	return GrafanaDatasourceRequestQueryCountKey.Int(val)
}

// Describes Grafana plugin attributes.
const (
	// GrafanaPluginIdKey is the attribute Key conforming to the
	// "grafana.plugin.id" semantic conventions. It represents the plugin ID.
	//
	// Type: string
	// RequirementLevel: Optional
	// Stability: stable
	// Examples: 'prometheus', 'loki', 'grafana-github-datasource'
	GrafanaPluginIdKey = attribute.Key("grafana.plugin.id")

	// GrafanaPluginTypeKey is the attribute Key conforming to the
	// "grafana.plugin.type" semantic conventions. It represents the plugin
	// type.
	//
	// Type: Enum
	// RequirementLevel: Optional
	// Stability: stable
	// Examples: 'datasource'
	GrafanaPluginTypeKey = attribute.Key("grafana.plugin.type")
)

var (
	// Data Source Plugin
	GrafanaPluginTypeDatasource = GrafanaPluginTypeKey.String("datasource")
	// Panel Plugin
	GrafanaPluginTypePanel = GrafanaPluginTypeKey.String("panel")
	// App Plugin
	GrafanaPluginTypeApp = GrafanaPluginTypeKey.String("app")
	// Renderer Plugin
	GrafanaPluginTypeRenderer = GrafanaPluginTypeKey.String("renderer")
	// Secret Manager Plugin
	GrafanaPluginTypeSecretmanager = GrafanaPluginTypeKey.String("secretmanager")
)

// GrafanaPluginId returns an attribute KeyValue conforming to the
// "grafana.plugin.id" semantic conventions. It represents the plugin ID.
func GrafanaPluginId(val string) attribute.KeyValue {
	return GrafanaPluginIdKey.String(val)
}
