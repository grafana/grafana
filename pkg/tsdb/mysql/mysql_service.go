package mysql

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	schemas "github.com/grafana/schemads"

	"github.com/grafana/grafana/pkg/tsdb/mysql/sqleng"
)

type Service struct {
	im              instancemgmt.InstanceManager
	logger          log.Logger
	resourceHandler backend.CallResourceHandler
}

func ProvideService() *Service {
	logger := backend.NewLoggerWith("logger", "tsdb.mysql")
	s := &Service{
		im:     datasource.NewInstanceManager(NewInstanceSettings(logger)),
		logger: logger,
	}

	schemaHandler := newMySQLSchema(s, logger)
	s.resourceHandler = schemas.NewSchemaDatasource(
		schemaHandler,
		schemaHandler,
		schemaHandler,
		schemaHandler,
		schemaHandler,
		nil,
	)

	return s
}

func (s *Service) getDataSourceHandler(ctx context.Context, pluginCtx backend.PluginContext) (*sqleng.DataSourceHandler, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(*sqleng.DataSourceHandler)
	return instance, nil
}

// NOTE: do not put any business logic into this method. it's whole job is to forward the call "inside"
func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsHandler, err := s.getDataSourceHandler(ctx, req.PluginContext)
	if err != nil {
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: err.Error()}, nil
	}

	return dsHandler.CheckHealth(ctx, req)
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	req = preprocessGrafanaSQLQueries(req)
	dsHandler, err := s.getDataSourceHandler(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	return dsHandler.QueryData(ctx, req)
}

func (s *Service) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	return s.resourceHandler.CallResource(ctx, req, sender)
}
