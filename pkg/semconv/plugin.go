package semconv

import (
	"go.opentelemetry.io/otel/attribute"
)

const (
	// The ID of the plugin.
	//
	// Type: string
	// Required: No
	// Stability: stable
	// Examples: "grafana-mqtt-datasource"
	GrafanaPluginIDKey = attribute.Key("grafana.plugin.id")
	// The type of the plugin.
	//
	// Type: string
	// Required: No
	// Stability: stable
	// Examples: "datasource"
	GrafanaPluginTypeKey = attribute.Key("grafana.plugin.type")
)

var (
	// "datasource"
	GrafanaPluginTypeDatasource = GrafanaPluginTypeKey.String("datasource")
	// "panel"
	GrafanaPluginTypePanel = GrafanaPluginTypeKey.String("panel")
	// "app"
	GrafanaPluginTypeApp = GrafanaPluginTypeKey.String("app")
	// "renderer"
	GrafanaPluginTypeRenderer = GrafanaPluginTypeKey.String("renderer")
	// "secretsmanager"
	GrafanaPluginTypeSecretsManager = GrafanaPluginTypeKey.String("secretsmanager")
)

// GrafanaPluginID generates an attribute with the ID of the plugin.
func GrafanaPluginID(id string) attribute.KeyValue {
	return GrafanaPluginIDKey.String(id)
}
