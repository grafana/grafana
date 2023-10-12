package pyroscope

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

// Make sure PyroscopeDatasource implements required interfaces. This is important to do
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

var logger = log.New("tsdb.pyroscope")

type Service struct {
	im instancemgmt.InstanceManager
}

func (s *Service) getInstance(ctx context.Context, pluginCtx backend.PluginContext) (*PyroscopeDatasource, error) {
	logger.Debug("getInstance called")

	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		logger.Debug("getInstance errored", "error", err)
		return nil, err
	}

	in := i.(*PyroscopeDatasource)
	logger.Debug("getInstance succeeded")
	return in, nil
}

func ProvideService(httpClientProvider httpclient.Provider, ac accesscontrol.AccessControl) *Service {
	return &Service{
		im: datasource.NewInstanceManager(newInstanceSettings(httpClientProvider, ac)),
	}
}

func newInstanceSettings(httpClientProvider httpclient.Provider, ac accesscontrol.AccessControl) datasource.InstanceFactoryFunc {
	return func(_ context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return NewPyroscopeDatasource(httpClientProvider, settings, ac)
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger.Debug("QueryData called", "queries", req.Queries)

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("QueryData errored", "error", err)
		return nil, err
	}

	response, err := i.QueryData(ctx, req)
	logger.Debug("QueryData succeeded")
	return response, err
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger.Debug("CallResource called")

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("CallResource errored", "error", err)
		return err
	}

	call := i.CallResource(ctx, req, sender)
	logger.Debug("CallResource succeeded")
	return call
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	logger.Debug("CheckHealth called")

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("CheckHealth errorer", "error", err)
		return nil, err
	}

	check, err := i.CheckHealth(ctx, req)
	logger.Debug("CheckHealth succeeded")
	return check, err
}

func (s *Service) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	logger.Debug("SubscribeStream called")

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("SubscribeStream errored", "error", err)
		return nil, err
	}

	stream, err := i.SubscribeStream(ctx, req)
	logger.Debug("SubscribeStream succeeded")
	return stream, err
}

func (s *Service) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	logger.Debug("RunStream called")

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("RunStream errored", "error", err)
		return err
	}

	stream := i.RunStream(ctx, req, sender)
	logger.Debug("RunStream succeeded")
	return stream
}

// PublishStream is called when a client sends a message to the stream.
func (s *Service) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	logger.Debug("PublishStream called")

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("PublishStream errored", "error", err)
		return nil, err
	}

	stream, err := i.PublishStream(ctx, req)
	logger.Debug("PublishStream succeeded")
	return stream, err
}
