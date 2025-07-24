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
	grafanaDatasourceTypeKey = attribute.Key("grafana.datasource.type")

	// GrafanaDatasourceUidKey is the attribute Key conforming to the
	// "grafana.datasource.uid" semantic conventions. It represents the
	// datasource unique identifier.
	//
	// Type: string
	// RequirementLevel: Optional
	// Stability: stable
	// Examples: 'abcdefg-123456'
	grafanaDatasourceUidKey = attribute.Key("grafana.datasource.uid")
)

// GrafanaDatasourceType returns an attribute KeyValue conforming to the
// "grafana.datasource.type" semantic conventions. It represents the datasource
// type.
func GrafanaDatasourceType(val string) attribute.KeyValue {
	return grafanaDatasourceTypeKey.String(val)
}

// GrafanaDatasourceUid returns an attribute KeyValue conforming to the
// "grafana.datasource.uid" semantic conventions. It represents the datasource
// unique identifier.
func GrafanaDatasourceUid(val string) attribute.KeyValue {
	return grafanaDatasourceUidKey.String(val)
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
	grafanaDatasourceRequestQueryCountKey = attribute.Key("grafana.datasource.request.query_count")
)

// GrafanaDatasourceRequestQueryCount returns an attribute KeyValue
// conforming to the "grafana.datasource.request.query_count" semantic
// conventions. It represents the number of queries in the request.
func GrafanaDatasourceRequestQueryCount(val int) attribute.KeyValue {
	return grafanaDatasourceRequestQueryCountKey.Int(val)
}

// Describes Kubernetes attributes.
const (
	// K8sDataplaneserviceNameKey is the attribute Key conforming to the
	// "k8s.dataplaneservice.name" semantic conventions. It represents the name
	// of the DataPlaneService.
	//
	// Type: string
	// RequirementLevel: Optional
	// Stability: stable
	// Examples: 'v0alpha1.prometheus.grafana.app'
	k8sDataplaneserviceNameKey = attribute.Key("k8s.dataplaneservice.name")
)

// K8sDataplaneserviceName returns an attribute KeyValue conforming to the
// "k8s.dataplaneservice.name" semantic conventions. It represents the name of
// the DataPlaneService.
func K8sDataplaneserviceName(val string) attribute.KeyValue {
	return k8sDataplaneserviceNameKey.String(val)
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
	grafanaPluginIdKey = attribute.Key("grafana.plugin.id")

	// GrafanaPluginTypeKey is the attribute Key conforming to the
	// "grafana.plugin.type" semantic conventions. It represents the plugin
	// type.
	//
	// Type: Enum
	// RequirementLevel: Optional
	// Stability: stable
	// Examples: 'datasource'
	grafanaPluginTypeKey = attribute.Key("grafana.plugin.type")
)

var (
	// Data Source Plugin
	GrafanaPluginTypeDatasource = grafanaPluginTypeKey.String("datasource")
	// Panel Plugin
	GrafanaPluginTypePanel = grafanaPluginTypeKey.String("panel")
	// App Plugin
	GrafanaPluginTypeApp = grafanaPluginTypeKey.String("app")
	// Renderer Plugin
	GrafanaPluginTypeRenderer = grafanaPluginTypeKey.String("renderer")
)

// GrafanaPluginId returns an attribute KeyValue conforming to the
// "grafana.plugin.id" semantic conventions. It represents the plugin ID.
func GrafanaPluginId(val string) attribute.KeyValue {
	return grafanaPluginIdKey.String(val)
}

// Describes Grafana service attributes.
const (
	// GrafanaServiceNameKey is the attribute Key conforming to the
	// "grafana.service.name" semantic conventions. It represents the service
	// name.
	//
	// Type: string
	// RequirementLevel: Optional
	// Stability: stable
	// Examples: 'grafana-apiserver'
	grafanaServiceNameKey = attribute.Key("grafana.service.name")
)

// GrafanaServiceName returns an attribute KeyValue conforming to the
// "grafana.service.name" semantic conventions. It represents the service name.
func GrafanaServiceName(val string) attribute.KeyValue {
	return grafanaServiceNameKey.String(val)
}
