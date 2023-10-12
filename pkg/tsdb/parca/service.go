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
	logger.Debug("getInstance called")

	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		logger.Debug("getInstance erorred", "error", err)
		return nil, err
	}

	in := i.(*ParcaDatasource)
	logger.Debug("getInstance succeded")
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
	logger.Debug("QueryData called")

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("QueryData errored", "error", err)
		return nil, err
	}

	data, err := i.QueryData(ctx, req)
	logger.Debug("QueryData succeeded")
	return data, err
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	logger.Debug("CallResource called")

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("CallResource errored", "error", err)
		return err
	}

	err = i.CallResource(ctx, req, sender)
	logger.Debug("CallResource succeeded")
	return err
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	logger.Debug("CheckHealth called")

	i, err := s.getInstance(ctx, req.PluginContext)
	if err != nil {
		logger.Debug("CheckHealth errored", "error", err)
		return nil, err
	}

	check, err := i.CheckHealth(ctx, req)
	logger.Debug("CheckHealth succeeded")
	return check, err
}
