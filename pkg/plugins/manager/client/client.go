package client

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/instrumentation"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var _ plugins.Client = (*PluginClientManager)(nil)

type PluginClientManager struct {
	pluginRegistry registry.Service
}

func ProvidePluginClient(pluginRegistry registry.Service) *PluginClientManager {
	return &PluginClientManager{
		pluginRegistry: pluginRegistry,
	}
}

func (m *PluginClientManager) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	plugin, exists := m.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	var resp *backend.QueryDataResponse
	err := instrumentation.InstrumentQueryDataRequest(req.PluginContext.PluginID, func() (innerErr error) {
		resp, innerErr = plugin.QueryData(ctx, req)
		return
	})

	if err != nil {
		if errors.Is(err, backendplugin.ErrMethodNotImplemented) {
			return nil, err
		}

		if errors.Is(err, backendplugin.ErrPluginUnavailable) {
			return nil, err
		}

		return nil, errutil.Wrap("failed to query data", err)
	}

	for refID, res := range resp.Responses {
		// set frame ref ID based on response ref ID
		for _, f := range res.Frames {
			if f.RefID == "" {
				f.RefID = refID
			}
		}
	}

	return resp, err
}

func (m *PluginClientManager) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	p, exists := m.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return backendplugin.ErrPluginNotRegistered
	}
	err := instrumentation.InstrumentCallResourceRequest(p.PluginID(), func() error {
		if err := p.CallResource(ctx, req, sender); err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return err
	}

	return nil
}

func (m *PluginClientManager) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	p, exists := m.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	var resp *backend.CollectMetricsResult
	err := instrumentation.InstrumentCollectMetrics(p.PluginID(), func() (innerErr error) {
		resp, innerErr = p.CollectMetrics(ctx, req)
		return
	})
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func (m *PluginClientManager) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	p, exists := m.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	var resp *backend.CheckHealthResult
	err := instrumentation.InstrumentCheckHealthRequest(p.PluginID(), func() (innerErr error) {
		resp, innerErr = p.CheckHealth(ctx, req)
		return
	})

	if err != nil {
		if errors.Is(err, backendplugin.ErrMethodNotImplemented) {
			return nil, err
		}

		if errors.Is(err, backendplugin.ErrPluginUnavailable) {
			return nil, err
		}

		return nil, errutil.Wrap("failed to check plugin health", backendplugin.ErrHealthCheckFailed)
	}

	return resp, nil
}

func (m *PluginClientManager) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	plugin, exists := m.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	return plugin.SubscribeStream(ctx, req)
}

func (m *PluginClientManager) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	plugin, exists := m.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	return plugin.PublishStream(ctx, req)
}

func (m *PluginClientManager) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	plugin, exists := m.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return backendplugin.ErrPluginNotRegistered
	}

	return plugin.RunStream(ctx, req, sender)
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (m *PluginClientManager) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := m.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return nil, false
	}

	if p.IsDecommissioned() {
		return nil, false
	}

	return p, true
}
