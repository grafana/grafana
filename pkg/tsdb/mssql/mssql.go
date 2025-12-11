package mssql

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"
	"github.com/grafana/grafana-azure-sdk-go/v2/azusercontext"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	_ "github.com/microsoft/go-mssqldb/integratedauth/krb5"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/mssql/sqleng"
)

type Service struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
}

func ProvideService(cfg *setting.Cfg) *Service {
	logger := backend.NewLoggerWith("logger", "tsdb.mssql")
	return &Service{
		im:     datasource.NewInstanceManager(NewInstanceSettings(cfg, logger)),
		logger: logger,
	}
}

func (s *Service) getDataSourceHandler(ctx context.Context, pluginCtx backend.PluginContext) (*sqleng.DataSourceHandler, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(*sqleng.DataSourceHandler)
	return instance, nil
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	dsHandler, err := s.getDataSourceHandler(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	return dsHandler.QueryData(azusercontext.WithUserFromQueryReq(ctx, req), req)
}

func NewInstanceSettings(cfg *setting.Cfg, logger log.Logger) datasource.InstanceFactoryFunc {
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		grafCfg := backend.GrafanaConfigFromContext(ctx)
		sqlCfg, err := grafCfg.SQL()
		if err != nil {
			return nil, err
		}
		pluginCfg := backend.PluginConfigFromContext(ctx)

		jsonData := sqleng.JsonData{
			MaxOpenConns:      sqlCfg.DefaultMaxOpenConns,
			MaxIdleConns:      sqlCfg.DefaultMaxIdleConns,
			ConnMaxLifetime:   sqlCfg.DefaultMaxConnLifetimeSeconds,
			Encrypt:           "false",
			ConnectionTimeout: 0,
			SecureDSProxy:     false,
		}

		azureSettings, err := azsettings.ReadSettings(ctx)
		if err != nil {
			logger.Error("failed to read Azure settings from Grafana", "error", err.Error())
			return nil, err
		}

		err = json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}

		database := jsonData.Database
		if database == "" {
			database = settings.Database
		}

		dsInfo := sqleng.DataSourceInfo{
			JsonData:                jsonData,
			URL:                     settings.URL,
			User:                    settings.User,
			Database:                database,
			ID:                      settings.ID,
			Updated:                 settings.Updated,
			UID:                     settings.UID,
			DecryptedSecureJSONData: settings.DecryptedSecureJSONData,
			OrgID:                   pluginCfg.OrgID,
		}

		userFacingDefaultError, err := grafCfg.UserFacingDefaultError()
		if err != nil {
			return nil, err
		}

		config := sqleng.DataPluginConfiguration{
			DSInfo:            dsInfo,
			MetricColumnTypes: []string{"VARCHAR", "CHAR", "NVARCHAR", "NCHAR"},
			RowLimit:          sqlCfg.RowLimit,
		}
		handler, err := sqleng.NewQueryDataHandler(ctx, settings, userFacingDefaultError, config, logger, azureSettings)
		if err != nil {
			logger.Error("Failed connecting to MSSQL", "err", err)
			return nil, err
		}

		logger.Debug("Successfully connected to MSSQL")
		return handler, nil
	}
}

// CheckHealth pings the connected SQL database
func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsHandler, err := s.getDataSourceHandler(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	return dsHandler.CheckHealth(azusercontext.WithUserFromHealthCheckReq(ctx, req), req)
}
