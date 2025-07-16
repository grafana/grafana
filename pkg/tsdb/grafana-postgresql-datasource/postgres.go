package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/lib/pq"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng"
)

func ProvideService(cfg *setting.Cfg) *Service {
	logger := backend.NewLoggerWith("logger", "tsdb.postgres")
	s := &Service{
		tlsManager: newTLSManager(logger, cfg.DataPath),
		logger:     logger,
	}
	s.im = datasource.NewInstanceManager(s.newInstanceSettings())
	return s
}

type Service struct {
	tlsManager tlsSettingsProvider
	im         instancemgmt.InstanceManager
	logger     log.Logger
}

func (s *Service) getDSInfo(ctx context.Context, pluginCtx backend.PluginContext) (*sqleng.DataSourceHandler, error) {
	i, err := s.im.Get(ctx, pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(*sqleng.DataSourceHandler)
	return instance, nil
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	dsInfo, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}
	return dsInfo.QueryData(ctx, req)
}

func newPostgres(ctx context.Context, userFacingDefaultError string, rowLimit int64, dsInfo sqleng.DataSourceInfo, cnnstr string, logger log.Logger, settings backend.DataSourceInstanceSettings) (*sql.DB, *sqleng.DataSourceHandler, error) {
	connector, err := pq.NewConnector(cnnstr)
	if err != nil {
		logger.Error("postgres connector creation failed", "error", err)
		return nil, nil, fmt.Errorf("postgres connector creation failed")
	}

	proxyClient, err := settings.ProxyClient(ctx)
	if err != nil {
		logger.Error("postgres proxy creation failed", "error", err)
		return nil, nil, fmt.Errorf("postgres proxy creation failed")
	}

	if proxyClient.SecureSocksProxyEnabled() {
		dialer, err := proxyClient.NewSecureSocksProxyContextDialer()
		if err != nil {
			logger.Error("postgres proxy creation failed", "error", err)
			return nil, nil, fmt.Errorf("postgres proxy creation failed")
		}
		postgresDialer := newPostgresProxyDialer(dialer)
		// update the postgres dialer with the proxy dialer
		connector.Dialer(postgresDialer)
	}

	config := sqleng.DataPluginConfiguration{
		DSInfo:            dsInfo,
		MetricColumnTypes: []string{"UNKNOWN", "TEXT", "VARCHAR", "CHAR"},
		RowLimit:          rowLimit,
	}

	queryResultTransformer := postgresQueryResultTransformer{}

	db := sql.OpenDB(connector)

	db.SetMaxOpenConns(config.DSInfo.JsonData.MaxOpenConns)
	db.SetMaxIdleConns(config.DSInfo.JsonData.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(config.DSInfo.JsonData.ConnMaxLifetime) * time.Second)

	handler, err := sqleng.NewQueryDataHandler(userFacingDefaultError, db, config, &queryResultTransformer, newPostgresMacroEngine(dsInfo.JsonData.Timescaledb),
		logger)
	if err != nil {
		logger.Error("Failed connecting to Postgres", "err", err)
		return nil, nil, err
	}

	logger.Debug("Successfully connected to Postgres")
	return db, handler, nil
}

func (s *Service) newInstanceSettings() datasource.InstanceFactoryFunc {
	logger := s.logger
	return func(ctx context.Context, settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		cfg := backend.GrafanaConfigFromContext(ctx)
		sqlCfg, err := cfg.SQL()
		if err != nil {
			return nil, err
		}

		jsonData := sqleng.JsonData{
			MaxOpenConns:        sqlCfg.DefaultMaxOpenConns,
			MaxIdleConns:        sqlCfg.DefaultMaxIdleConns,
			ConnMaxLifetime:     sqlCfg.DefaultMaxConnLifetimeSeconds,
			Timescaledb:         false,
			ConfigurationMethod: string(TLSConfigurationMethodFilePath),
			SecureDSProxy:       false,
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
		}

		cnnstr, err := GenerateConnectionString(dsInfo, s.tlsManager, logger)
		if err != nil {
			return nil, err
		}

		userFacingDefaultError, err := cfg.UserFacingDefaultError()
		if err != nil {
			return nil, err
		}

		_, handler, err := newPostgres(ctx, userFacingDefaultError, sqlCfg.RowLimit, dsInfo, cnnstr, logger, settings)

		if err != nil {
			logger.Error("Failed connecting to Postgres", "err", err)
			return nil, err
		}

		logger.Debug("Successfully connected to Postgres")
		return handler, nil
	}
}

// escape single quotes and backslashes in Postgres connection string parameters.
func escape(input string) string {
	return strings.ReplaceAll(strings.ReplaceAll(input, `\`, `\\`), "'", `\'`)
}

type postgresQueryResultTransformer struct{}

func (t *postgresQueryResultTransformer) TransformQueryError(_ log.Logger, err error) error {
	return err
}

// CheckHealth pings the connected SQL database
func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsHandler, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return sqleng.ErrToHealthCheckResult(err)
	}
	return dsHandler.CheckHealth(ctx, req)
}

func (t *postgresQueryResultTransformer) GetConverterList() []sqlutil.StringConverter {
	return []sqlutil.StringConverter{
		{
			Name:           "handle FLOAT4",
			InputScanKind:  reflect.Interface,
			InputTypeName:  "FLOAT4",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseFloat(*in, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle FLOAT8",
			InputScanKind:  reflect.Interface,
			InputTypeName:  "FLOAT8",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseFloat(*in, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle NUMERIC",
			InputScanKind:  reflect.Interface,
			InputTypeName:  "NUMERIC",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseFloat(*in, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle INT2",
			InputScanKind:  reflect.Interface,
			InputTypeName:  "INT2",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableInt16,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					i64, err := strconv.ParseInt(*in, 10, 16)
					if err != nil {
						return nil, err
					}
					v := int16(i64)
					return &v, nil
				},
			},
		},
	}
}
