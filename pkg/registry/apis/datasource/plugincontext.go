package datasource

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type PluginContextProvider interface {
	PluginContextForDataSource(ctx context.Context, pluginID, name string) (backend.PluginContext, error)
}
