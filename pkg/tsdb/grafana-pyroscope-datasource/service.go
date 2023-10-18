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

type Service struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
}

var logger = log.New("tsdb.pyroscope")

func (s *Service) getInstance(ctx context.Context, pluginCtx backend.PluginContext) (*PyroscopeDatasource, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		s.logger.FromContext(ctx).Error("Failed to get instance", "error", err, "pluginID", pluginCtx.PluginID)
		return nil, err
	}
	in := i.(*PyroscopeDatasource)
	return in, nil
}

func ProvideService(httpClientProvider httpclient.Provider, ac accesscontrol.AccessControl) *Service {
	return &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(httpClientProvider, ac)),
		logger: logger,
	}
}

func newInstanceSettings(httpClientProvider httpclient.Provider, ac accesscontrol.AccessControl) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return NewPyroscopeDatasource(ctx, httpClientProvider, settings, ac)
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	loggerWithContext := s.logger.FromContext(ctx)
	loggerWithContext.Debug("Processing queries", "queries", req.Queries)

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	response, err := i.QueryData(ctx, req)
	if err != nil {
		loggerWithContext.Error("Received error from Pyroscope", "error", err)
	} else {
		loggerWithContext.Debug("All queries processed")
	}
	return response, err
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	loggerWithContext := s.logger.FromContext(ctx)
	loggerWithContext.Debug("Calling resource")

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return err
	}

	err = i.CallResource(ctx, req, sender)
	if err != nil {
		loggerWithContext.Error("Received error from Pyroscope", "error", err)
	} else {
		loggerWithContext.Debug("Health check succeeded")
	}
	return err
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	loggerWithContext := s.logger.FromContext(ctx)
	loggerWithContext.Debug("Checking health")

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	response, err := i.CheckHealth(ctx, req)
	if err != nil {
		loggerWithContext.Error("Received error from Pyroscope", "error", err)
	} else {
		loggerWithContext.Debug("Health check succeeded")
	}
	return response, err
}

func (s *Service) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	loggerWithContext := s.logger.FromContext(ctx)
	loggerWithContext.Debug("Subscribing stream")

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	response, err := i.SubscribeStream(ctx, req)
	if err != nil {
		loggerWithContext.Error("Received error from Pyroscope", "error", err)
	} else {
		loggerWithContext.Debug("Stream subscribed")
	}
	return response, err
}

func (s *Service) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	loggerWithContext := s.logger.FromContext(ctx)
	loggerWithContext.Debug("Running stream")

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return err
	}

	err = i.RunStream(ctx, req, sender)
	if err != nil {
		loggerWithContext.Error("Received error from Pyroscope", "error", err)
	} else {
		loggerWithContext.Debug("Stream run")
	}
	return err
}

// PublishStream is called when a client sends a message to the stream.
func (s *Service) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	loggerWithContext := s.logger.FromContext(ctx)
	loggerWithContext.Debug("Publishing stream")

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	response, err := i.PublishStream(ctx, req)
	if err != nil {
		loggerWithContext.Error("Received error from Pyroscope", "error", err)
	} else {
		loggerWithContext.Debug("Stream published")
	}
	return response, err
}
