// Code generated from semantic convention specification. DO NOT EDIT.

package grafanaconv // import "github.com/grafana/grafana/pkg/grafanaconv"

import (
	"fmt"

	"go.opentelemetry.io/otel/attribute"
)

// Namespace: grafana
const (
	// DatasourceRequestQueryCountKey is the attribute Key conforming to the "grafana.datasource.request.query_count" semantic conventions. It represents the number of queries in the request.
	//
	// Type: int
	// RequirementLevel: Recommended
	// Stability: Stable
	DatasourceRequestQueryCountKey = attribute.Key("grafana.datasource.request.query_count")

	// DatasourceTypeKey is the attribute Key conforming to the "grafana.datasource.type" semantic conventions. It represents the datasource type.
	//
	// Type: string
	// RequirementLevel: Recommended
	// Stability: Stable
	//
	// Examples: "prometheus", "loki", "grafana-github-datasource"
	DatasourceTypeKey = attribute.Key("grafana.datasource.type")

	// DatasourceUIDKey is the attribute Key conforming to the "grafana.datasource.uid" semantic conventions. It represents the datasource unique identifier.
	//
	// Type: string
	// RequirementLevel: Recommended
	// Stability: Stable
	//
	// Examples: abcdefg-123456
	DatasourceUIDKey = attribute.Key("grafana.datasource.uid")

	// K8sDataplaneserviceNameKey is the attribute Key conforming to the "grafana.k8s.dataplaneservice.name" semantic conventions. It represents the name of the DataPlaneService.
	//
	// Type: string
	// RequirementLevel: Recommended
	// Stability: Stable
	//
	// Examples: "v0alpha1.prometheus.grafana.app"
	K8sDataplaneserviceNameKey = attribute.Key("grafana.k8s.dataplaneservice.name")

	// PluginClassKey is the attribute Key conforming to the "grafana.plugin.class" semantic conventions. It represents the plugin class indicating the plugin source.
	//
	// Type: Enum
	// RequirementLevel: Recommended
	// Stability: Stable
	//
	// Examples: external
	PluginClassKey = attribute.Key("grafana.plugin.class")

	// PluginCountKey is the attribute Key conforming to the "grafana.plugin.count" semantic conventions. It represents the number of plugins processed in an operation.
	//
	// Type: int
	// RequirementLevel: Recommended
	// Stability: Stable
	PluginCountKey = attribute.Key("grafana.plugin.count")

	// PluginErrorCodeKey is the attribute Key conforming to the "grafana.plugin.error_code" semantic conventions. It represents the error code when a plugin operation fails.
	//
	// Type: string
	// RequirementLevel: Recommended
	// Stability: Stable
	//
	// Examples: plugin_not_found
	PluginErrorCodeKey = attribute.Key("grafana.plugin.error_code")

	// PluginIDKey is the attribute Key conforming to the "grafana.plugin.id" semantic conventions. It represents the plugin ID.
	//
	// Type: string
	// RequirementLevel: Recommended
	// Stability: Stable
	//
	// Examples: "prometheus", "loki", "grafana-github-datasource"
	PluginIDKey = attribute.Key("grafana.plugin.id")

	// PluginTypeKey is the attribute Key conforming to the "grafana.plugin.type" semantic conventions. It represents the plugin type.
	//
	// Type: Enum
	// RequirementLevel: Recommended
	// Stability: Stable
	//
	// Examples: datasource
	PluginTypeKey = attribute.Key("grafana.plugin.type")

	// ServiceNameKey is the attribute Key conforming to the "grafana.service.name" semantic conventions. It represents the service name.
	//
	// Type: string
	// RequirementLevel: Recommended
	// Stability: Stable
	//
	// Examples: "grafana-apiserver"
	ServiceNameKey = attribute.Key("grafana.service.name")
)

// DatasourceRequestQueryCount returns an attribute KeyValue conforming to the "grafana.datasource.request.query_count" semantic conventions. It represents the number of queries in the request.
func DatasourceRequestQueryCount(val int) attribute.KeyValue {
	return DatasourceRequestQueryCountKey.Int(val)
}

// DatasourceType returns an attribute KeyValue conforming to the "grafana.datasource.type" semantic conventions. It represents the datasource type.
func DatasourceType(val string) attribute.KeyValue {
	return DatasourceTypeKey.String(val)
}

// DatasourceUID returns an attribute KeyValue conforming to the "grafana.datasource.uid" semantic conventions. It represents the datasource unique identifier.
func DatasourceUID(val string) attribute.KeyValue {
	return DatasourceUIDKey.String(val)
}

// K8sDataplaneserviceName returns an attribute KeyValue conforming to the "grafana.k8s.dataplaneservice.name" semantic conventions. It represents the name of the DataPlaneService.
func K8sDataplaneserviceName(val string) attribute.KeyValue {
	return K8sDataplaneserviceNameKey.String(val)
}

// PluginClass returns an attribute KeyValue conforming to the "grafana.plugin.class" semantic conventions. It represents the plugin class indicating the plugin source.
func PluginClass(val fmt.Stringer) attribute.KeyValue {
	return PluginClassKey.String(val.String())
}

// PluginCount returns an attribute KeyValue conforming to the "grafana.plugin.count" semantic conventions. It represents the number of plugins processed in an operation.
func PluginCount(val int) attribute.KeyValue {
	return PluginCountKey.Int(val)
}

// PluginErrorCode returns an attribute KeyValue conforming to the "grafana.plugin.error_code" semantic conventions. It represents the error code when a plugin operation fails.
func PluginErrorCode(val string) attribute.KeyValue {
	return PluginErrorCodeKey.String(val)
}

// PluginID returns an attribute KeyValue conforming to the "grafana.plugin.id" semantic conventions. It represents the plugin ID.
func PluginID(val string) attribute.KeyValue {
	return PluginIDKey.String(val)
}

// PluginType returns an attribute KeyValue conforming to the "grafana.plugin.type" semantic conventions. It represents the plugin type.
func PluginType(val fmt.Stringer) attribute.KeyValue {
	return PluginTypeKey.String(val.String())
}

// ServiceName returns an attribute KeyValue conforming to the "grafana.service.name" semantic conventions. It represents the service name.
func ServiceName(val string) attribute.KeyValue {
	return ServiceNameKey.String(val)
}

// Enum values for grafana.plugin.class
var (
	// Core plugin bundled with Grafana
	// Stability: stable
	PluginClassCore = PluginClassKey.String("core")
	// External plugin
	// Stability: stable
	PluginClassExternal = PluginClassKey.String("external")
	// Plugin loaded from CDN
	// Stability: stable
	PluginClassCdn = PluginClassKey.String("cdn")
)

// Enum values for grafana.plugin.type
var (
	// Data Source Plugin
	// Stability: stable
	PluginTypeDatasource = PluginTypeKey.String("datasource")
	// Panel Plugin
	// Stability: stable
	PluginTypePanel = PluginTypeKey.String("panel")
	// App Plugin
	// Stability: stable
	PluginTypeApp = PluginTypeKey.String("app")
	// Renderer Plugin
	// Stability: stable
	PluginTypeRenderer = PluginTypeKey.String("renderer")
)
