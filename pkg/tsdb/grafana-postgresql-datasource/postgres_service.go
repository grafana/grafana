package postgres

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	sqlengpgx "github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/pgx"
	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng"
)

type Service struct {
	im       instancemgmt.InstanceManager
	features featuremgmt.FeatureToggles
}

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles) *Service {
	logger := backend.NewLoggerWith("logger", "tsdb.postgres")
	s := &Service{
		im:       datasource.NewInstanceManager(NewInstanceSettings(logger, features, cfg.DataPath)),
		features: features,
	}
	return s
}

// NOTE: do not put any business logic into this method. it's whole job is to forward the call "inside"
func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if s.features.IsEnabled(ctx, featuremgmt.FlagPostgresDSUsePGX) {
		dsHandler, err := s.getDSInfoPGX(ctx, req.PluginContext)
		if err != nil {
			return sqlengpgx.ErrToHealthCheckResult(err)
		}
		return dsHandler.CheckHealth(ctx, req)
	} else {
		dsHandler, err := s.getDSInfo(ctx, req.PluginContext)
		if err != nil {
			return sqleng.ErrToHealthCheckResult(err)
		}
		return dsHandler.CheckHealth(ctx, req)
	}
}

// NOTE: do not put any business logic into this method. it's whole job is to forward the call "inside"
func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if s.features.IsEnabled(ctx, featuremgmt.FlagPostgresDSUsePGX) {
		dsInfo, err := s.getDSInfoPGX(ctx, req.PluginContext)
		if err != nil {
			return nil, err
		}
		return dsInfo.QueryData(ctx, req)
	} else {
		dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
		if err != nil {
			return nil, err
		}
		return dsInfo.QueryData(ctx, req)
	}
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*sqleng.DataSourceHandler, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(*sqleng.DataSourceHandler)
	return instance, nil
}

func (s *Service) getDSInfoPGX(ctx context.Context, pluginCtx backend.PluginContext) (*sqlengpgx.DataSourceHandler, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(*sqlengpgx.DataSourceHandler)
	return instance, nil
}
