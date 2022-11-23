package client

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"google.golang.org/grpc/metadata"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/instrumentation"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/services/auth/jwt"
	"github.com/grafana/grafana/pkg/services/store"
)

var _ plugins.Client = (*Service)(nil)

type Service struct {
	pluginRegistry registry.Service
	jwtAuthService jwt.PluginAuthService
	cfg            *config.Cfg
}

func ProvideService(pluginRegistry registry.Service, cfg *config.Cfg, jwtAuthService jwt.PluginAuthService) *Service {
	return &Service{
		pluginRegistry: pluginRegistry,
		jwtAuthService: jwtAuthService,
		cfg:            cfg,
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	plugin, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, plugins.ErrPluginNotRegistered.Errorf("%w", backendplugin.ErrPluginNotRegistered)
	}

	ctx = s.attachJWT(ctx, req.PluginContext)

	var resp *backend.QueryDataResponse
	err := instrumentation.InstrumentQueryDataRequest(ctx, &req.PluginContext, s.cfg, func() (innerErr error) {
		resp, innerErr = plugin.QueryData(ctx, req)
		return
	})

	if err != nil {
		if errors.Is(err, backendplugin.ErrMethodNotImplemented) {
			return nil, plugins.ErrMethodNotImplemented.Errorf("%w", backendplugin.ErrMethodNotImplemented)
		}

		if errors.Is(err, backendplugin.ErrPluginUnavailable) {
			return nil, plugins.ErrPluginUnavailable.Errorf("%w", backendplugin.ErrPluginUnavailable)
		}

		return nil, plugins.ErrPluginDownstreamError.Errorf("%v: %w", "failed to query data", err)
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

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	p, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return backendplugin.ErrPluginNotRegistered
	}
	ctx = s.attachJWT(ctx, req.PluginContext)
	err := instrumentation.InstrumentCallResourceRequest(ctx, &req.PluginContext, s.cfg, func() error {
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

func (s *Service) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	p, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	var resp *backend.CollectMetricsResult
	err := instrumentation.InstrumentCollectMetrics(ctx, &req.PluginContext, s.cfg, func() (innerErr error) {
		resp, innerErr = p.CollectMetrics(ctx, req)
		return
	})
	if err != nil {
		return nil, err
	}

	return resp, nil
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	p, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	ctx = s.attachJWT(ctx, req.PluginContext)

	var resp *backend.CheckHealthResult
	err := instrumentation.InstrumentCheckHealthRequest(ctx, &req.PluginContext, s.cfg, func() (innerErr error) {
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

		return nil, fmt.Errorf("%v: %w", "failed to check plugin health", backendplugin.ErrHealthCheckFailed)
	}

	return resp, nil
}

func (s *Service) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	plugin, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	ctx = s.attachJWT(ctx, req.PluginContext)

	return plugin.SubscribeStream(ctx, req)
}

func (s *Service) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	plugin, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return nil, backendplugin.ErrPluginNotRegistered
	}

	ctx = s.attachJWT(ctx, req.PluginContext)

	return plugin.PublishStream(ctx, req)
}

func (s *Service) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	plugin, exists := s.plugin(ctx, req.PluginContext.PluginID)
	if !exists {
		return backendplugin.ErrPluginNotRegistered
	}

	ctx = s.attachJWT(ctx, req.PluginContext)

	return plugin.RunStream(ctx, req, sender)
}

// plugin finds a plugin with `pluginID` from the registry that is not decommissioned
func (s *Service) plugin(ctx context.Context, pluginID string) (*plugins.Plugin, bool) {
	p, exists := s.pluginRegistry.Plugin(ctx, pluginID)
	if !exists {
		return nil, false
	}

	if p.IsDecommissioned() {
		return nil, false
	}

	return p, true
}

func (s *Service) attachJWT(ctx context.Context, pluginCtx backend.PluginContext) context.Context {
	if !s.jwtAuthService.IsEnabled() {
		return ctx
	}

	user, err := appcontext.User(ctx)
	if err != nil || user == nil || user.IsAnonymous || user.IsDisabled {
		return ctx
	}

	token, err := s.jwtAuthService.Generate(store.GetUserIDString(user), pluginCtx.PluginID)
	if err != nil {
		return ctx
	}

	return metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token)
}
