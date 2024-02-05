package v0alpha1

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
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

		// The raw backend query objects
		query []GenericDataQuery,
	) (*backend.QueryDataResponse, error)
}

type DataSourceApiServerRegistry interface {
	// Get the group and preferred version for a plugin
	GetDatasourceGroupVersion(pluginId string) (schema.GroupVersion, error)

	// Get the list of available datasource api servers
	// The values will be managed though API discovery/reconciliation
	GetDatasourceApiServers(ctx context.Context) (*DataSourceApiServerList, error)
}

type ExpressionQuery interface {
	// Required input variables (parsed out of the query)
	Variables() []string

	// Execute an expression with the selected input variables
	Execute(ctx context.Context, input QueryDataResponse) (backend.DataResponse, error)
}
