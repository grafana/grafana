package cloudwatch

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
)

func ProvideService() *Service {
	return &Service{
		datasource.NewInstanceManager(NewDatasource),
	}
}

type Service struct {
	im instancemgmt.InstanceManager
}

func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	instance, err := s.im.Get(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	return instance.(*DataSource).CheckHealth(ctx, req)
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	instance, err := s.im.Get(ctx, req.PluginContext)
	if err != nil {
		return err
	}
	return instance.(*DataSource).CallResource(ctx, req, sender)
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	instance, err := s.im.Get(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	return instance.(*DataSource).QueryData(ctx, req)
}
