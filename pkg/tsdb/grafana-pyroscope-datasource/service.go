package phlare

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// Make sure PhlareDatasource implements required interfaces. This is important to do
// since otherwise we will only get a not implemented error response from plugin in
// runtime. In this example datasource instance implements backend.QueryDataHandler,
// backend.CheckHealthHandler, backend.StreamHandler interfaces. Plugin should not
// implement all these interfaces - only those which are required for a particular task.
// For example if plugin does not need streaming functionality then you are free to remove
// methods that implement backend.StreamHandler. Implementing instancemgmt.InstanceDisposer
// is useful to clean up resources used by previous datasource instance when a new datasource
// instance created upon datasource settings changed.
var (
	_ backend.QueryDataHandler    = (*Service)(nil)
	_ backend.CallResourceHandler = (*Service)(nil)
	_ backend.CheckHealthHandler  = (*Service)(nil)
	_ backend.StreamHandler       = (*Service)(nil)
)

var logger = log.New("tsdb.phlare")

type Service struct {
	im instancemgmt.InstanceManager
}

func (s *Service) getInstance(ctx context.Context, pluginCtx backend.PluginContext) (*PhlareDatasource, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}
	in := i.(*PhlareDatasource)
	return in, nil
}

func ProvideService(httpClientProvider httpclient.Provider, ac accesscontrol.AccessControl) *Service {
	return &Service{
		im: datasource.NewInstanceManager(newInstanceSettings(httpClientProvider, ac)),
	}
}

func newInstanceSettings(httpClientProvider httpclient.Provider, ac accesscontrol.AccessControl) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return NewPhlareDatasource(httpClientProvider, settings, ac)
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	return i.QueryData(ctx, req)
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return err
	}
	return i.CallResource(ctx, req, sender)
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	return i.CheckHealth(ctx, req)
}

func (s *Service) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	return i.SubscribeStream(ctx, req)
}

func (s *Service) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return err
	}
	return i.RunStream(ctx, req, sender)
}

// PublishStream is called when a client sends a message to the stream.
func (s *Service) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	return i.PublishStream(ctx, req)
}
