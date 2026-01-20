package checks

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/plugincontext"
)

// HealthCheckerImpl implements the HealthChecker interface by wrapping
// PluginContextProvider and PluginClient.
type HealthCheckerImpl struct {
	PluginContextProvider *plugincontext.Provider
	PluginClient          plugins.Client
}

func (h *HealthCheckerImpl) CheckHealth(ctx context.Context, ds *datasources.DataSource) (*backend.CheckHealthResult, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	pCtx, err := h.PluginContextProvider.GetWithDataSource(ctx, ds.Type, requester, ds)
	if err != nil {
		return nil, err
	}
	req := &backend.CheckHealthRequest{
		PluginContext: pCtx,
		Headers:       map[string]string{},
	}
	return h.PluginClient.CheckHealth(ctx, req)
}
