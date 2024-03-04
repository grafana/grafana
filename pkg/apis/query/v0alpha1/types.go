package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkapi "github.com/grafana/grafana-plugin-sdk-go/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// The query runner interface
type QueryRunner interface {
	// Runs the query as the user in context
	ExecuteQueryData(ctx context.Context,
		// The k8s group for the datasource (pluginId)
		datasource schema.GroupVersion,

		// The datasource name/uid
		name string,

		// Query request -- the datasource in each query should either be empty
		// or match the two previous parameters
		request sdkapi.DataQueryRequest,
	) (*backend.QueryDataResponse, error)
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

	Items []DataSourceApiServer `json:"items,omitempty"`
}
