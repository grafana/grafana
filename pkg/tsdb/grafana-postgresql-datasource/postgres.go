package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	pgxstdlib "github.com/jackc/pgx/v5/stdlib"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/tls"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

func ProvideService(cfg *setting.Cfg) *Service {
	logger := backend.NewLoggerWith("logger", "tsdb.postgres")
	s := &Service{
		logger: logger,
	}
	s.im = datasource.NewInstanceManager(s.newInstanceSettings())
	return s
}

type Service struct {
	im     instancemgmt.InstanceManager
	logger log.Logger
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

func newPostgres(ctx context.Context, userFacingDefaultError string, rowLimit int64, dsInfo sqleng.DataSourceInfo, pgxConf *pgx.ConnConfig, logger log.Logger, settings backend.DataSourceInstanceSettings) (*sql.DB, *sqleng.DataSourceHandler, error) {
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

		pgxConf.DialFunc = newPgxDialFunc(dialer)
	}

	config := sqleng.DataPluginConfiguration{
		DSInfo:            dsInfo,
		MetricColumnTypes: []string{"UNKNOWN", "TEXT", "VARCHAR", "CHAR"},
		RowLimit:          rowLimit,
	}

	queryResultTransformer := postgresQueryResultTransformer{}

	db := pgxstdlib.OpenDB(*pgxConf)

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
			ConfigurationMethod: "file-path",
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

		pgxConf, err := generateConnectionConfig(dsInfo)
		if err != nil {
			return nil, err
		}

		userFacingDefaultError, err := cfg.UserFacingDefaultError()
		if err != nil {
			return nil, err
		}

		_, handler, err := newPostgres(ctx, userFacingDefaultError, sqlCfg.RowLimit, dsInfo, pgxConf, logger, settings)

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

func generateConnectionConfig(dsInfo sqleng.DataSourceInfo) (*pgx.ConnConfig, error) {
	var host string
	var port int
	if strings.HasPrefix(dsInfo.URL, "/") {
		host = dsInfo.URL
	} else {
		index := strings.LastIndex(dsInfo.URL, ":")
		v6Index := strings.Index(dsInfo.URL, "]")
		sp := strings.SplitN(dsInfo.URL, ":", 2)
		host = sp[0]
		if v6Index == -1 {
			if len(sp) > 1 {
				var err error
				port, err = strconv.Atoi(sp[1])
				if err != nil {
					return nil, fmt.Errorf("invalid port in host specifier %q: %w", sp[1], err)
				}
			}
		} else {
			if index == v6Index+1 {
				host = dsInfo.URL[1 : index-1]
				var err error
				port, err = strconv.Atoi(dsInfo.URL[index+1:])
				if err != nil {
					return nil, fmt.Errorf("invalid port in host specifier %q: %w", dsInfo.URL[index+1:], err)
				}
			} else {
				host = dsInfo.URL[1 : len(dsInfo.URL)-1]
			}
		}
	}

	// NOTE: we always set sslmode=disable in the connection string, we handle TLS manually later
	connStr := fmt.Sprintf("sslmode=disable user='%s' password='%s' host='%s' dbname='%s'",
		escape(dsInfo.User), escape(dsInfo.DecryptedSecureJSONData["password"]), escape(host), escape(dsInfo.Database))
	if port > 0 {
		connStr += fmt.Sprintf(" port=%d", port)
	}

	conf, err := pgx.ParseConfig(connStr)
	if err != nil {
		return nil, err
	}

	tlsConf, err := tls.GetTLSConfig(dsInfo, os.ReadFile, host)
	if err != nil {
		return nil, err
	}

	// before we set the TLS config, we need to make sure the `.Fallbacks` attribute is unset, see:
	// https://github.com/jackc/pgx/discussions/1903#discussioncomment-8430146
	if len(conf.Fallbacks) > 0 {
		return nil, errors.New("tls: fallbacks configured, unable to set up TLS config")
	}
	conf.TLSConfig = tlsConf

	return conf, nil
}

type postgresQueryResultTransformer struct{}

func (t *postgresQueryResultTransformer) TransformQueryError(_ log.Logger, err error) error {
	return err
}

// CheckHealth pings the connected SQL database
func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsHandler, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	err = dsHandler.Ping()

	if err != nil {
		s.logger.Error("Check health failed", "error", err)
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: dsHandler.TransformQueryError(s.logger, err).Error()}, nil
	}

	return &backend.CheckHealthResult{Status: backend.HealthStatusOk, Message: "Database Connection OK"}, nil
}

func (t *postgresQueryResultTransformer) GetConverterList() []sqlutil.StringConverter {
	return []sqlutil.StringConverter{
		{
			Name:           "handle TIME WITH TIME ZONE",
			InputScanKind:  reflect.Interface,
			InputTypeName:  strconv.Itoa(pgtype.TimetzOID),
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableTime,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					v, err := time.Parse("15:04:05-07", *in)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle TIME",
			InputScanKind:  reflect.Interface,
			InputTypeName:  "TIME",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableTime,
				ReplaceFunc: func(in *string) (any, error) {
					if in == nil {
						return nil, nil
					}
					v, err := time.Parse("15:04:05", *in)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
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
