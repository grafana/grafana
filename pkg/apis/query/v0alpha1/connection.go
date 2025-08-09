package v0alpha1

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Connection to a datasource instance
// The connection name must be 'ds:{group}:{name}'
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSourceConnection struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// The configured display name
	Title string `json:"title"`

	// Reference to the kubernets datasource
	Datasource DataSourceConnectionRef `json:"datasource"`
}

type DataSourceConnectionRef struct {
	Group   string `json:"group"`
	Version string `json:"version"`
	Name    string `json:"name"`

	// The plugin ID -- NOTE, this has a 1:1 mapping with apiGroup and should likely be removed
	PluginID string `json:"pluginId"`
}

// The valid connection name for a group + identifier
func DataSourceConnectionName(group, name string) string {
	return group + ":" + name
}

// List of all datasource instances across all datasource apiservers
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSourceConnectionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []DataSourceConnection `json:"items"`
}

type DataSourceApiServerRegistry interface {
	// Get the group and preferred version for a plugin
	GetDatasourceGroupVersion(pluginId string) (schema.GroupVersion, error)

	// Get the list of available datasource api servers
	// The values will be managed though API discovery/reconciliation
	GetDatasourceApiServers(ctx context.Context) (*DataSourceApiServerList, error)
}

// The data source resource is a reflection of the individual datasource instances
// that are exposed in the groups: {datasource}.datasource.grafana.app
// The status is updated periodically.
// The name is the plugin id
//
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSourceApiServer struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	// The display name
	Title string `json:"title"`

	// Describe the plugin
	Description string `json:"description,omitempty"`

	// The group + preferred version
	GroupVersion string `json:"groupVersion"`

	// Possible alternative plugin IDs
	AliasIDs []string `json:"aliasIDs,omitempty"`
}

// List of datasource plugins
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSourceApiServerList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []DataSourceApiServer `json:"items"`
}
