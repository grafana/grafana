package runner

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

type QueryRunner interface {
	// Runs the query as the user in context
	ExecuteQueryData(ctx context.Context,
		// The k8s group for the datasource (pluginId)
		datasource schema.GroupVersion,

		// The datasource name/uid
		name string,

		// The raw backend query objects
		query []backend.DataQuery,
	) (*backend.QueryDataResponse, error)
}

type DataSourceRegistry interface {
	// Get the group and prefered version for a plugin
	GetDatasourceAPI(pluginId string) (schema.GroupVersion, error)

	// Get the list of available datasource plugins
	// The values will be managed though API discovery/reconciliation
	GetDatasourcePlugins(ctx context.Context, options *internalversion.ListOptions) (*v0alpha1.DataSourcePluginList, error)

	// Get the list of all datasource instances (across all plugins)
	// The values will be managed though API discovery/reconciliation
	GetDataSources(ctx context.Context, namespace string, options *internalversion.ListOptions) (*v0alpha1.DataSourceList, error)
}
