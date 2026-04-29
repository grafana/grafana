package v0alpha1

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Get all datasource connections -- this will be backed by search or duplicated resource in unified storage
type DataSourceConnectionProvider interface {
	// List lists all data sources the user in context can see
	ListConnections(ctx context.Context, query DataSourceConnectionQuery) (*DataSourceConnectionList, error)
}

// List of all datasource instances across all datasource apiservers
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSourceConnectionQuery struct {
	metav1.TypeMeta `json:",inline"`

	// the namespace
	Namespace string `json:"namespace"`

	// The datasource identifier inside the group/version (or UID within legacy grafana apis)
	Name string `json:"name,omitempty"`

	// The plugin ID
	Plugin string `json:"plugin,omitempty"`
}

func (DataSourceConnectionQuery) OpenAPIModelName() string {
	return OpenAPIPrefix + "DataSourceConnectionQuery"
}

// Connection to a datasource instance
type DataSourceConnection struct {
	// The configured display name
	Title string `json:"title"`

	// The datasource identifier inside the group/version (or UID within legacy grafana apis)
	Name string `json:"name"`

	APIGroup string `json:"group"`

	APIVersion string `json:"version"`

	Plugin string `json:"plugin,omitempty"`

	// TODO: labels? things the UI would need to show in a list
}

func (DataSourceConnection) OpenAPIModelName() string {
	return OpenAPIPrefix + "DataSourceConnection"
}

// List of all datasource instances across all datasource apiservers
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSourceConnectionList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitzero,omitempty"`

	Items []DataSourceConnection `json:"items"`
}

func (DataSourceConnectionList) OpenAPIModelName() string {
	return OpenAPIPrefix + "DataSourceConnectionList"
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
	metav1.ObjectMeta `json:"metadata,omitzero,omitempty"`

	// The display name
	Title string `json:"title"`

	// Describe the plugin
	Description string `json:"description,omitempty"`

	// The group + preferred version
	GroupVersion string `json:"groupVersion"`

	// Possible alternative plugin IDs
	AliasIDs []string `json:"aliasIDs,omitempty"`
}

func (DataSourceApiServer) OpenAPIModelName() string {
	return OpenAPIPrefix + "DataSourceApiServer"
}

// List of datasource plugins
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DataSourceApiServerList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitzero,omitempty"`

	Items []DataSourceApiServer `json:"items"`
}

func (DataSourceApiServerList) OpenAPIModelName() string {
	return OpenAPIPrefix + "DataSourceApiServerList"
}
