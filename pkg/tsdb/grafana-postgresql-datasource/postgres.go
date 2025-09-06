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
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/lib/pq"

	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/grafana/grafana/pkg/tsdb/grafana-postgresql-datasource/sqleng"
)

func ProvideService(cfg *setting.Cfg, features featuremgmt.FeatureToggles) *Service {
	logger := backend.NewLoggerWith("logger", "tsdb.postgres")
	s := &Service{
		tlsManager:    newTLSManager(logger, cfg.DataPath),
		pgxTlsManager: newPgxTlsManager(logger),
		logger:        logger,
		features:      features,
	}
	s.im = datasource.NewInstanceManager(s.newInstanceSettings())
	return s
}

type Service struct {
	tlsManager    tlsSettingsProvider
	pgxTlsManager *pgxTlsManager
	im            instancemgmt.InstanceManager
	logger        log.Logger
	features      featuremgmt.FeatureToggles
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

	if s.features.IsEnabled(ctx, featuremgmt.FlagPostgresDSUsePGX) {
		return dsInfo.QueryDataPGX(ctx, req)
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

func newPostgresPGX(ctx context.Context, userFacingDefaultError string, rowLimit int64, dsInfo sqleng.DataSourceInfo, cnnstr string, logger log.Logger, settings backend.DataSourceInstanceSettings) (*pgxpool.Pool, *sqleng.DataSourceHandler, error) {
	pgxConf, err := pgxpool.ParseConfig(cnnstr)
	if err != nil {
		logger.Error("postgres config creation failed", "error", err)
		return nil, nil, fmt.Errorf("postgres config creation failed")
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

		pgxConf.ConnConfig.DialFunc = newPgxDialFunc(dialer)
	}

	// by default pgx resolves hostnames to ip addresses. we must avoid this.
	// (certain socks-proxy related functionality relies on the hostname being preserved)
	pgxConf.ConnConfig.LookupFunc = func(_ context.Context, host string) ([]string, error) {
		return []string{host}, nil
	}

	config := sqleng.DataPluginConfiguration{
		DSInfo:            dsInfo,
		MetricColumnTypes: []string{"unknown", "text", "varchar", "char", "bpchar"},
		RowLimit:          rowLimit,
	}

	queryResultTransformer := postgresQueryResultTransformer{}
	pgxConf.MaxConnLifetime = time.Duration(config.DSInfo.JsonData.ConnMaxLifetime) * time.Second
	pgxConf.MaxConns = int32(config.DSInfo.JsonData.MaxOpenConns)

	p, err := pgxpool.NewWithConfig(ctx, pgxConf)
	if err != nil {
		logger.Error("Failed connecting to Postgres", "err", err)
		return nil, nil, err
	}

	handler, err := sqleng.NewQueryDataHandlerPGX(userFacingDefaultError, p, config, &queryResultTransformer, newPostgresMacroEngine(dsInfo.JsonData.Timescaledb),
		logger)
	if err != nil {
		logger.Error("Failed connecting to Postgres", "err", err)
		return nil, nil, err
	}

	logger.Debug("Successfully connected to Postgres")
	return p, handler, nil
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

		isPGX := s.features.IsEnabled(ctx, featuremgmt.FlagPostgresDSUsePGX)

		userFacingDefaultError, err := cfg.UserFacingDefaultError()
		if err != nil {
			return nil, err
		}

		var handler instancemgmt.Instance
		if isPGX {
			pgxTlsSettings, err := s.pgxTlsManager.getTLSSettings(dsInfo)
			if err != nil {
				return "", err
			}

			// Ensure cleanupCertFiles is called after the connection is opened
			defer s.pgxTlsManager.cleanupCertFiles(pgxTlsSettings)
			cnnstr, err := s.generateConnectionString(dsInfo, pgxTlsSettings, isPGX)
			if err != nil {
				return "", err
			}
			_, handler, err = newPostgresPGX(ctx, userFacingDefaultError, sqlCfg.RowLimit, dsInfo, cnnstr, logger, settings)
			if err != nil {
				logger.Error("Failed connecting to Postgres", "err", err)
				return nil, err
			}
		} else {
			tlsSettings, err := s.tlsManager.getTLSSettings(dsInfo)
			if err != nil {
				return "", err
			}
			cnnstr, err := s.generateConnectionString(dsInfo, tlsSettings, isPGX)
			if err != nil {
				return nil, err
			}
			_, handler, err = newPostgres(ctx, userFacingDefaultError, sqlCfg.RowLimit, dsInfo, cnnstr, logger, settings)
			if err != nil {
				logger.Error("Failed connecting to Postgres", "err", err)
				return nil, err
			}
		}

		logger.Debug("Successfully connected to Postgres")
		return handler, nil
	}
}

// escape single quotes and backslashes in Postgres connection string parameters.
func escape(input string) string {
	return strings.ReplaceAll(strings.ReplaceAll(input, `\`, `\\`), "'", `\'`)
}

type connectionParams struct {
	host     string
	port     int
	user     string
	password string
	database string
}

func parseConnectionParams(dsInfo sqleng.DataSourceInfo, logger log.Logger) (connectionParams, error) {
	var params connectionParams
	var err error

	if strings.HasPrefix(dsInfo.URL, "/") {
		params.host = dsInfo.URL
		logger.Debug("Generating connection string with Unix socket specifier", "address", dsInfo.URL)
	} else {
		params.host, params.port, err = parseNetworkAddress(dsInfo.URL, logger)
		if err != nil {
			return connectionParams{}, err
		}
	}

	params.user = dsInfo.User
	params.password = dsInfo.DecryptedSecureJSONData["password"]
	params.database = dsInfo.Database

	return params, nil
}

func parseNetworkAddress(url string, logger log.Logger) (string, int, error) {
	index := strings.LastIndex(url, ":")
	v6Index := strings.Index(url, "]")
	sp := strings.SplitN(url, ":", 2)
	host := sp[0]
	port := 0

	if v6Index == -1 {
		if len(sp) > 1 {
			var err error
			port, err = strconv.Atoi(sp[1])
			if err != nil {
				logger.Debug("Error parsing the IPv4 address", "address", url)
				return "", 0, sqleng.ErrParsingPostgresURL
			}
			logger.Debug("Generating IPv4 connection string with network host/port pair", "host", host, "port", port, "address", url)
		} else {
			logger.Debug("Generating IPv4 connection string with network host", "host", host, "address", url)
		}
	} else {
		if index == v6Index+1 {
			host = url[1 : index-1]
			var err error
			port, err = strconv.Atoi(url[index+1:])
			if err != nil {
				logger.Debug("Error parsing the IPv6 address", "address", url)
				return "", 0, sqleng.ErrParsingPostgresURL
			}
			logger.Debug("Generating IPv6 connection string with network host/port pair", "host", host, "port", port, "address", url)
		} else {
			host = url[1 : len(url)-1]
			logger.Debug("Generating IPv6 connection string with network host", "host", host, "address", url)
		}
	}

	return host, port, nil
}

func buildBaseConnectionString(params connectionParams) string {
	connStr := fmt.Sprintf("user='%s' host='%s' dbname='%s'",
		escape(params.user), escape(params.host), escape(params.database))

	if params.password != "" {
		connStr += fmt.Sprintf(" password='%s'", escape(params.password))
	}

	if params.port > 0 {
		connStr += fmt.Sprintf(" port=%d", params.port)
	}
	return connStr
}

func (s *Service) generateConnectionString(dsInfo sqleng.DataSourceInfo, tlsSettings tlsSettings, isPGX bool) (string, error) {
	logger := s.logger

	params, err := parseConnectionParams(dsInfo, logger)
	if err != nil {
		return "", err
	}

	connStr := buildBaseConnectionString(params)

	connStr += fmt.Sprintf(" sslmode='%s'", escape(tlsSettings.Mode))

	// there is an issue with the lib/pq module, the `verify-ca` tls mode
	// does not work correctly. ( see https://github.com/lib/pq/issues/1106 )
	// to workaround the problem, if the `verify-ca` mode is chosen,
	// we disable sslsni.
	if tlsSettings.Mode == "verify-ca" && !isPGX {
		logger.Debug("Disabling sslsni for verify-ca mode")
		connStr += " sslsni=0"
	}

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
	dsHandler, err := s.getDSInfo(ctx, req.PluginContext)
	if err != nil {
		return sqleng.ErrToHealthCheckResult(err)
	}
	return dsHandler.CheckHealth(ctx, req, s.features)
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
