package coreplugin

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/tsdb"
)

type corePlugin struct {
	pluginID string
	logger   log.Logger
	backend.CheckHealthHandler
	backend.CallResourceHandler
	backend.QueryDataHandler
}

// New returns a new backendplugin.PluginFactoryFunc for creating a core (built-in) backendplugin.Plugin.
func New(opts backend.ServeOpts) backendplugin.PluginFactoryFunc {
	return backendplugin.PluginFactoryFunc(func(pluginID string, logger log.Logger, env []string) (backendplugin.Plugin, error) {
		return &corePlugin{
			pluginID:            pluginID,
			logger:              logger,
			CheckHealthHandler:  opts.CheckHealthHandler,
			CallResourceHandler: opts.CallResourceHandler,
			QueryDataHandler:    opts.QueryDataHandler,
		}, nil
	})
}

func (cp *corePlugin) PluginID() string {
	return cp.pluginID
}

func (cp *corePlugin) Logger() log.Logger {
	return cp.logger
}

func (cp *corePlugin) Start(ctx context.Context) error {
	if cp.QueryDataHandler != nil {
		tsdb.RegisterTsdbQueryEndpoint(cp.pluginID, func(dsInfo *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
			return newQueryEndpointAdapter(cp.pluginID, cp.logger, backendplugin.InstrumentQueryDataHandler(cp.QueryDataHandler)), nil
		})
	}
	return nil
}

func (cp *corePlugin) Stop(ctx context.Context) error {
	return nil
}

func (cp *corePlugin) IsManaged() bool {
	return false
}

func (cp *corePlugin) Exited() bool {
	return false
}

func (cp *corePlugin) CollectMetrics(ctx context.Context) (*backend.CollectMetricsResult, error) {
	return nil, backendplugin.ErrMethodNotImplemented
}

func (cp *corePlugin) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if cp.CheckHealthHandler != nil {
		return cp.CheckHealthHandler.CheckHealth(ctx, req)
	}

	return nil, backendplugin.ErrMethodNotImplemented
}

func (cp *corePlugin) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if cp.CallResourceHandler != nil {
		return cp.CallResourceHandler.CallResource(ctx, req, sender)
	}

	return backendplugin.ErrMethodNotImplemented
}
