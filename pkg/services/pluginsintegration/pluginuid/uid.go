package pluginuid

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/services/datasources"
)

func FromPluginContext(pCtx backend.PluginContext) string {
	return pCtx.PluginID
}

func FromDataSource(ds *datasources.DataSource) string {
	return ds.Type
}
