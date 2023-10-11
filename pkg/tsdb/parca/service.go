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

var logger = log.New("tsdb.parca")

type Service struct {
	im instancemgmt.InstanceManager
}

func (s *Service) getInstance(ctx context.Context, pluginCtx backend.PluginContext) (*ParcaDatasource, error) {
	logger.Debug("Get instance")
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		logger.Debug("Error in getting instance", "error", err)
		return nil, err
	}
	in := i.(*ParcaDatasource)
	logger.Debug("Get instance")
	return in, nil
}

func ProvideService(httpClientProvider httpclient.Provider) *Service {
	return &Service{
		im: datasource.NewInstanceManager(newInstanceSettings(httpClientProvider)),
	}
}

func newInstanceSettings(httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(_ context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		return NewParcaDatasource(httpClientProvider, settings)
	}
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	logger.Debug("Successfully processed query request")
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("Successfully processed query request")
		return nil, err
	}
	logger.Debug("Successfully processed query request")
	return i.QueryData(ctx, req)
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger.Debug("Calling resource")
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("Error in calling resource", "error", err)
		return err
	}
	logger.Debug("Successfully called resource")
	return i.CallResource(ctx, req, sender)
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	logger.Debug("Check health")
	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("Error in checking health", "error", err)
		return nil, err
	}
	logger.Debug("Successfully checked health")
	return i.CheckHealth(ctx, req)
}
