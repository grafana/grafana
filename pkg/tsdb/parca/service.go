package parca

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
)

// Make sure ParcaDatasource implements required interfaces. This is important to do
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
)

type Service struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
}

var logger = log.New("tsdb.parca")

func (s *Service) getInstance(ctx context.Context, pluginCtx backend.PluginContext) (*ParcaDatasource, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		logger.Error("Failed to get instance", "error", err, "pluginID", pluginCtx.PluginID)
		return nil, err
	}
	in := i.(*ParcaDatasource)
	return in, nil
}

func ProvideService(httpClientProvider httpclient.Provider) *Service {
	return &Service{
		im:     datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
		logger: logger,
	}
}

func newInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(_ context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return NewParcaDatasource(httpClientProvider, settings)
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	loggerWithContext := s.logger.FromContext(ctx)
	loggerWithContext.Debug("Processing queries", "queryLength", len(req.Queries))

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	data, err := i.QueryData(ctx, req)
	if err != nil {
		loggerWithContext.Error("Received error from Parca", "error", err)
	} else {
		loggerWithContext.Debug("All queries processed")
	}
	return data, err
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	loggerWithContext := s.logger.FromContext(ctx)
	loggerWithContext.Debug("Calling resource", "path", req.Path)

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		return err
	}

	err = i.CallResource(ctx, req, sender)
	if err != nil {
		loggerWithContext.Error("Failed to call resource", "error", err)
	} else {
		loggerWithContext.Debug("Resource called")
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

	check, err := i.CheckHealth(ctx, req)
	if err != nil {
		loggerWithContext.Error("Health check failed", "error", err)
	} else {
		loggerWithContext.Debug("Health check succeeded")
	}
	return check, err
}
