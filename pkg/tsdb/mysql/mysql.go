package mysql

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/VividCortex/mysqlerr"
	"github.com/go-sql-driver/mysql"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"

	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

const (
	dateFormat      = "2006-01-02"
	dateTimeFormat1 = "2006-01-02 15:04:05"
	dateTimeFormat2 = "2006-01-02T15:04:05Z"
)

var logger = log.New("tsdb.mysql")

type Service struct {
	Cfg *setting.Cfg
	im  instancemgmt.InstanceManager
}

func characterEscape(s string, escapeChar string) string {
	return strings.ReplaceAll(s, escapeChar, url.QueryEscape(escapeChar))
}

func ProvideService(cfg *setting.Cfg, httpClientProvider httpclient.Provider) *Service {
	return &Service{
		im: datasource.NewInstanceManager(newInstanceSettings(cfg, httpClientProvider)),
	}
}

func newInstanceSettings(cfg *setting.Cfg, httpClientProvider httpclient.Provider) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonData := sqleng.JsonData{
			MaxOpenConns:    cfg.SqlDatasourceMaxOpenConnsDefault,
			MaxIdleConns:    cfg.SqlDatasourceMaxIdleConnsDefault,
			ConnMaxLifetime: cfg.SqlDatasourceMaxConnLifetimeDefault,
			SecureDSProxy:   false,
		}

		err := json.Unmarshal(settings.JSONData, &jsonData)
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

		protocol := "tcp"
		if strings.HasPrefix(dsInfo.URL, "/") {
			protocol = "unix"
		}

		// register the secure socks proxy dialer context, if enabled
		if cfg.IsFeatureToggleEnabled(featuremgmt.FlagSecureSocksDatasourceProxy) && cfg.SecureSocksDSProxy.Enabled && jsonData.SecureDSProxy {
			// UID is only unique per org, the only way to ensure uniqueness is to do it by connection information
			uniqueIdentifier := dsInfo.User + dsInfo.DecryptedSecureJSONData["password"] + dsInfo.URL + dsInfo.Database
			protocol, err = registerProxyDialerContext(&cfg.SecureSocksDSProxy, protocol, uniqueIdentifier)
			if err != nil {
				return nil, err
			}
		}

		cnnstr := fmt.Sprintf("%s:%s@%s(%s)/%s?collation=utf8mb4_unicode_ci&parseTime=true&loc=UTC&allowNativePasswords=true",
			characterEscape(dsInfo.User, ":"),
			dsInfo.DecryptedSecureJSONData["password"],
			protocol,
			characterEscape(dsInfo.URL, ")"),
			characterEscape(dsInfo.Database, "?"),
		)

		opts, err := settings.HTTPClientOptions()
		if err != nil {
			return nil, err
		}

		tlsConfig, err := httpClientProvider.GetTLSConfig(opts)
		if err != nil {
			return nil, err
		}

		if tlsConfig.RootCAs != nil || len(tlsConfig.Certificates) > 0 {
			tlsConfigString := fmt.Sprintf("ds%d", settings.ID)
			if err := mysql.RegisterTLSConfig(tlsConfigString, tlsConfig); err != nil {
				return nil, err
			}
			cnnstr += "&tls=" + tlsConfigString
		}

		if dsInfo.JsonData.Timezone != "" {
			cnnstr += fmt.Sprintf("&time_zone='%s'", url.QueryEscape(dsInfo.JsonData.Timezone))
		}

		if cfg.Env == setting.Dev {
			logger.Debug("GetEngine", "connection", cnnstr)
		}

		config := sqleng.DataPluginConfiguration{
			DriverName:        "mysql",
			ConnectionString:  cnnstr,
			DSInfo:            dsInfo,
			TimeColumnNames:   []string{"time", "time_sec"},
			MetricColumnTypes: []string{"CHAR", "VARCHAR", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT"},
			RowLimit:          cfg.DataProxyRowLimit,
		}

		rowTransformer := mysqlQueryResultTransformer{}

		return sqleng.NewQueryDataHandler(config, &rowTransformer, newMysqlMacroEngine(logger), logger)
	}
}

func (s *Service) getDataSourceHandler(pluginCtx backend.PluginContext) (*sqleng.DataSourceHandler, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(*sqleng.DataSourceHandler)
	return instance, nil
}

// CheckHealth pings the connected SQL database
func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsHandler, err := s.getDataSourceHandler(req.PluginContext)
	if err != nil {
		return nil, err
	}

	err = dsHandler.Ping()

	if err != nil {
		var driverErr *mysql.MySQLError
		if errors.As(err, &driverErr) {
			return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: dsHandler.TransformQueryError(logger, driverErr).Error()}, nil
		}
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: dsHandler.TransformQueryError(logger, err).Error()}, nil
	}
	return &backend.CheckHealthResult{Status: backend.HealthStatusOk, Message: "Database Connection OK"}, nil
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	dsHandler, err := s.getDataSourceHandler(req.PluginContext)
	if err != nil {
		return nil, err
	}
	return dsHandler.QueryData(ctx, req)
}

type mysqlQueryResultTransformer struct {
}

func (t *mysqlQueryResultTransformer) TransformQueryError(logger log.Logger, err error) error {
	var driverErr *mysql.MySQLError
	if errors.As(err, &driverErr) {
		if driverErr.Number != mysqlerr.ER_PARSE_ERROR && driverErr.Number != mysqlerr.ER_BAD_FIELD_ERROR &&
			driverErr.Number != mysqlerr.ER_NO_SUCH_TABLE {
			logger.Error("Query error", "error", err)
			return errQueryFailed
		}
	}

	return err
}

var errQueryFailed = errors.New("query failed - please inspect Grafana server log for details")

func (t *mysqlQueryResultTransformer) GetConverterList() []sqlutil.StringConverter {
	// For the MySQL driver , we have these possible data types:
	// https://www.w3schools.com/sql/sql_datatypes.asp#:~:text=In%20MySQL%20there%20are%20three,numeric%2C%20and%20date%20and%20time.
	// Since by default, we convert all into String, we need only to handle the Numeric data types
	return []sqlutil.StringConverter{
		{
			Name:           "handle DOUBLE",
			InputScanKind:  reflect.Struct,
			InputTypeName:  "DOUBLE",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (interface{}, error) {
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
			Name:           "handle BIGINT",
			InputScanKind:  reflect.Struct,
			InputTypeName:  "BIGINT",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableInt64,
				ReplaceFunc: func(in *string) (interface{}, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseInt(*in, 10, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle DECIMAL",
			InputScanKind:  reflect.Slice,
			InputTypeName:  "DECIMAL",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (interface{}, error) {
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
			Name:           "handle DATETIME",
			InputScanKind:  reflect.Struct,
			InputTypeName:  "DATETIME",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableTime,
				ReplaceFunc: func(in *string) (interface{}, error) {
					if in == nil {
						return nil, nil
					}
					v, err := time.Parse(dateTimeFormat1, *in)
					if err == nil {
						return &v, nil
					}
					v, err = time.Parse(dateTimeFormat2, *in)
					if err == nil {
						return &v, nil
					}

					return nil, err
				},
			},
		},
		{
			Name:           "handle DATE",
			InputScanKind:  reflect.Struct,
			InputTypeName:  "DATE",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableTime,
				ReplaceFunc: func(in *string) (interface{}, error) {
					if in == nil {
						return nil, nil
					}
					v, err := time.Parse(dateFormat, *in)
					if err == nil {
						return &v, nil
					}
					v, err = time.Parse(dateTimeFormat1, *in)
					if err == nil {
						return &v, nil
					}
					v, err = time.Parse(dateTimeFormat2, *in)
					if err == nil {
						return &v, nil
					}
					return nil, err
				},
			},
		},
		{
			Name:           "handle TIMESTAMP",
			InputScanKind:  reflect.Struct,
			InputTypeName:  "TIMESTAMP",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableTime,
				ReplaceFunc: func(in *string) (interface{}, error) {
					if in == nil {
						return nil, nil
					}
					v, err := time.Parse(dateTimeFormat1, *in)
					if err == nil {
						return &v, nil
					}
					v, err = time.Parse(dateTimeFormat2, *in)
					if err == nil {
						return &v, nil
					}
					return nil, err
				},
			},
		},
		{
			Name:           "handle YEAR",
			InputScanKind:  reflect.Struct,
			InputTypeName:  "YEAR",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableInt64,
				ReplaceFunc: func(in *string) (interface{}, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseInt(*in, 10, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle TINYINT",
			InputScanKind:  reflect.Struct,
			InputTypeName:  "TINYINT",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableInt64,
				ReplaceFunc: func(in *string) (interface{}, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseInt(*in, 10, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle SMALLINT",
			InputScanKind:  reflect.Struct,
			InputTypeName:  "SMALLINT",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableInt64,
				ReplaceFunc: func(in *string) (interface{}, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseInt(*in, 10, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle INT",
			InputScanKind:  reflect.Struct,
			InputTypeName:  "INT",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableInt64,
				ReplaceFunc: func(in *string) (interface{}, error) {
					if in == nil {
						return nil, nil
					}
					v, err := strconv.ParseInt(*in, 10, 64)
					if err != nil {
						return nil, err
					}
					return &v, nil
				},
			},
		},
		{
			Name:           "handle FLOAT",
			InputScanKind:  reflect.Struct,
			InputTypeName:  "FLOAT",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableFloat64,
				ReplaceFunc: func(in *string) (interface{}, error) {
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
	}
}
