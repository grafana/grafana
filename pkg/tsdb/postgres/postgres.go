package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

var logger = log.New("tsdb.postgres")

func ProvideService(cfg *setting.Cfg) *Service {
	s := &Service{
		tlsManager: newTLSManager(logger, cfg.DataPath),
	}
	s.im = datasource.NewInstanceManager(s.newInstanceSettings(cfg))
	return s
}

type Service struct {
	tlsManager tlsSettingsProvider
	im         instancemgmt.InstanceManager
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (*sqleng.DataSourceHandler, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(*sqleng.DataSourceHandler)
	return instance, nil
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}
	return dsInfo.QueryData(ctx, req)
}

func (s *Service) newInstanceSettings(cfg *setting.Cfg) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		// Allow override of default for max open conns
		var maxOpenConnsDefault = sqleng.MaxOpenConnsDefault
		if cfg.SqlDatasourceMaxOpenConnsDefault != maxOpenConnsDefault {
			maxOpenConnsDefault = cfg.SqlDatasourceMaxOpenConnsDefault
		}

		// Allow override of default for max idle conns
		var maxIdleConnsDefault = sqleng.MaxIdleConnsDefault
		if cfg.SqlDatasourceMaxOpenConnsDefault != maxIdleConnsDefault {
			maxIdleConnsDefault = cfg.SqlDatasourceMaxIdleConnsDefault
		}

		// Allow override of the default for max connection lifetime
		var connMaxLifetimeDefault = sqleng.ConnMaxLifetimeDefault
		if cfg.SqlDatasourceMaxConnLifetimeDefault != connMaxLifetimeDefault {
			connMaxLifetimeDefault = cfg.SqlDatasourceMaxConnLifetimeDefault
		}

		logger.Debug("Creating Postgres query endpoint")
		jsonData := sqleng.JsonData{
			MaxOpenConns:        maxOpenConnsDefault,
			MaxIdleConns:        maxIdleConnsDefault,
			ConnMaxLifetime:     connMaxLifetimeDefault,
			Timescaledb:         false,
			ConfigurationMethod: "file-path",
			SecureDSProxy:       false,
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

		cnnstr, err := s.generateConnectionString(dsInfo)
		if err != nil {
			return nil, err
		}

		if cfg.Env == setting.Dev {
			logger.Debug("GetEngine", "connection", cnnstr)
		}

		driverName := "postgres"
		// register a proxy driver if the secure socks proxy is enabled
		if cfg.IsFeatureToggleEnabled(featuremgmt.FlagSecureSocksDatasourceProxy) && cfg.SecureSocksDSProxy.Enabled && jsonData.SecureDSProxy {
			driverName, err = createPostgresProxyDriver(&cfg.SecureSocksDSProxy, cnnstr)
			if err != nil {
				return "", nil
			}
		}

		config := sqleng.DataPluginConfiguration{
			DriverName:        driverName,
			ConnectionString:  cnnstr,
			DSInfo:            dsInfo,
			MetricColumnTypes: []string{"UNKNOWN", "TEXT", "VARCHAR", "CHAR"},
			RowLimit:          cfg.DataProxyRowLimit,
		}

		queryResultTransformer := postgresQueryResultTransformer{}

		handler, err := sqleng.NewQueryDataHandler(config, &queryResultTransformer, newPostgresMacroEngine(dsInfo.JsonData.Timescaledb),
			logger)
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

func (s *Service) generateConnectionString(dsInfo sqleng.DataSourceInfo) (string, error) {
	var host string
	var port int
	if strings.HasPrefix(dsInfo.URL, "/") {
		host = dsInfo.URL
		logger.Debug("Generating connection string with Unix socket specifier", "socket", host)
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
					return "", fmt.Errorf("invalid port in host specifier %q: %w", sp[1], err)
				}

				logger.Debug("Generating connection string with network host/port pair", "host", host, "port", port)
			} else {
				logger.Debug("Generating connection string with network host", "host", host)
			}
		} else {
			if index == v6Index+1 {
				host = dsInfo.URL[1 : index-1]
				var err error
				port, err = strconv.Atoi(dsInfo.URL[index+1:])
				if err != nil {
					return "", fmt.Errorf("invalid port in host specifier %q: %w", dsInfo.URL[index+1:], err)
				}

				logger.Debug("Generating ipv6 connection string with network host/port pair", "host", host, "port", port)
			} else {
				host = dsInfo.URL[1 : len(dsInfo.URL)-1]
				logger.Debug("Generating ipv6 connection string with network host", "host", host)
			}
		}
	}

	connStr := fmt.Sprintf("user='%s' password='%s' host='%s' dbname='%s'",
		escape(dsInfo.User), escape(dsInfo.DecryptedSecureJSONData["password"]), escape(host), escape(dsInfo.Database))
	if port > 0 {
		connStr += fmt.Sprintf(" port=%d", port)
	}

	tlsSettings, err := s.tlsManager.getTLSSettings(dsInfo)
	if err != nil {
		return "", err
	}

	connStr += fmt.Sprintf(" sslmode='%s'", escape(tlsSettings.Mode))

	// Attach root certificate if provided
	if tlsSettings.RootCertFile != "" {
		logger.Debug("Setting server root certificate", "tlsRootCert", tlsSettings.RootCertFile)
		connStr += fmt.Sprintf(" sslrootcert='%s'", escape(tlsSettings.RootCertFile))
	}

	// Attach client certificate and key if both are provided
	if tlsSettings.CertFile != "" && tlsSettings.CertKeyFile != "" {
		logger.Debug("Setting TLS/SSL client auth", "tlsCert", tlsSettings.CertFile, "tlsKey", tlsSettings.CertKeyFile)
		connStr += fmt.Sprintf(" sslcert='%s' sslkey='%s'", escape(tlsSettings.CertFile), escape(tlsSettings.CertKeyFile))
	} else if tlsSettings.CertFile != "" || tlsSettings.CertKeyFile != "" {
		return "", fmt.Errorf("TLS/SSL client certificate and key must both be specified")
	}

	logger.Debug("Generated Postgres connection string successfully")
	return connStr, nil
}

type postgresQueryResultTransformer struct{}

func (t *postgresQueryResultTransformer) TransformQueryError(_ log.Logger, err error) error {
	return err
}

// CheckHealth pings the connected SQL database
func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsHandler, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}

	err = dsHandler.Ping()

	if err != nil {
		logger.Error("Check health failed", "error", err)
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: dsHandler.TransformQueryError(logger, err).Error()}, nil
	}

	return &backend.CheckHealthResult{Status: backend.HealthStatusOk, Message: "Database Connection OK"}, nil
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
			Name:           "handle FLOAT8",
			InputScanKind:  reflect.Interface,
			InputTypeName:  "FLOAT8",
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
			Name:           "handle NUMERIC",
			InputScanKind:  reflect.Interface,
			InputTypeName:  "NUMERIC",
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
			Name:           "handle INT2",
			InputScanKind:  reflect.Interface,
			InputTypeName:  "INT2",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableInt16,
				ReplaceFunc: func(in *string) (interface{}, error) {
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
