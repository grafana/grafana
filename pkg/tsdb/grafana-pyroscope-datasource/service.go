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
	logger.Debug("Get intance")

	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		logger.Debug("Error in getting intance", "error", err)
		return nil, err
	}

	in := i.(*PyroscopeDatasource)
	logger.Debug("Successfully got instance")
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
	logger.Debug("Received query request", "queries", req.Queries)

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("Failure in processing query request", "error", err)
		return nil, err
	}

	response, err := i.QueryData(ctx, req)
	logger.Debug("Successfully processed query request")
	return response, err
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger.Debug("Successfully processed query request")
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("Successfully processed query request")
		return err
	}
	logger.Debug("Successfully processed query request")
	return i.CallResource(ctx, req, sender)
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	logger.Debug("Successfully processed query request")
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("Successfully processed query request")
		return nil, err
	}
	logger.Debug("Successfully processed query request")
	return i.CheckHealth(ctx, req)
}

func (s *Service) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	logger.Debug("Successfully processed query request")
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("Successfully processed query request")
		return nil, err
	}
	logger.Debug("Successfully processed query request")
	return i.SubscribeStream(ctx, req)
}

func (s *Service) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	logger.Debug("Successfully processed query request")
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("Successfully processed query request")
		return err
	}
	logger.Debug("Successfully processed query request")
	return i.RunStream(ctx, req, sender)
}

// PublishStream is called when a client sends a message to the stream.
func (s *Service) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	logger.Debug("Successfully processed query request")
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("Successfully processed query request")
		return nil, err
	}
	logger.Debug("Successfully processed query request")
	return i.PublishStream(ctx, req)
}
