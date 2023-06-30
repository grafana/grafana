package mssql

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"reflect"
	"regexp"
	"strconv"
	"strings"

	mssql "github.com/grafana/go-mssqldb"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"github.com/grafana/grafana/pkg/util"
)

var logger = log.New("tsdb.mssql")

type Service struct {
	im instancemgmt.InstanceManager
}

func ProvideService(cfg *setting.Cfg) *Service {
	return &Service{
		im: datasource.NewInstanceManager(newInstanceSettings(cfg)),
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
	return dsHandler.QueryData(ctx, req)
}

func newInstanceSettings(cfg *setting.Cfg) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonData := sqleng.JsonData{
			MaxOpenConns:      cfg.SqlDatasourceMaxOpenConnsDefault,
			MaxIdleConns:      cfg.SqlDatasourceMaxIdleConnsDefault,
			ConnMaxLifetime:   cfg.SqlDatasourceMaxConnLifetimeDefault,
			Encrypt:           "false",
			ConnectionTimeout: 0,
			SecureDSProxy:     false,
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
		cnnstr, err := generateConnectionString(dsInfo)
		if err != nil {
			return nil, err
		}

		if cfg.Env == setting.Dev {
			logger.Debug("GetEngine", "connection", cnnstr)
		}

		driverName := "mssql"
		// register a new proxy driver if the secure socks proxy is enabled
		if cfg.SecureSocksDSProxy.Enabled && jsonData.SecureDSProxy {
			driverName, err = createMSSQLProxyDriver(&cfg.SecureSocksDSProxy, cnnstr)
			if err != nil {
				return nil, err
			}
		}

		config := sqleng.DataPluginConfiguration{
			DriverName:        driverName,
			ConnectionString:  cnnstr,
			DSInfo:            dsInfo,
			MetricColumnTypes: []string{"VARCHAR", "CHAR", "NVARCHAR", "NCHAR"},
			RowLimit:          cfg.DataProxyRowLimit,
		}

		queryResultTransformer := mssqlQueryResultTransformer{
			userError: cfg.UserFacingDefaultError,
		}

		return sqleng.NewQueryDataHandler(cfg, config, &queryResultTransformer, newMssqlMacroEngine(), logger)
	}
}

// ParseURL tries to parse an MSSQL URL string into a URL object.
func ParseURL(u string) (*url.URL, error) {
	logger.Debug("Parsing MSSQL URL", "url", u)

	// Recognize ODBC connection strings like host\instance:1234
	reODBC := regexp.MustCompile(`^[^\\:]+(?:\\[^:]+)?(?::\d+)?(?:;.+)?$`)
	var host string
	switch {
	case reODBC.MatchString(u):
		logger.Debug("Recognized as ODBC URL format", "url", u)
		host = u
	default:
		logger.Debug("Couldn't recognize as valid MSSQL URL", "url", u)
		return nil, fmt.Errorf("unrecognized MSSQL URL format: %q", u)
	}
	return &url.URL{
		Scheme: "sqlserver",
		Host:   host,
	}, nil
}

func generateConnectionString(dsInfo sqleng.DataSourceInfo) (string, error) {
	const dfltPort = "0"
	var addr util.NetworkAddress
	if dsInfo.URL != "" {
		u, err := ParseURL(dsInfo.URL)
		if err != nil {
			return "", err
		}
		addr, err = util.SplitHostPortDefault(u.Host, "localhost", dfltPort)
		if err != nil {
			return "", err
		}
	} else {
		addr = util.NetworkAddress{
			Host: "localhost",
			Port: dfltPort,
		}
	}

	args := []interface{}{
		"url", dsInfo.URL, "host", addr.Host,
	}
	if addr.Port != "0" {
		args = append(args, "port", addr.Port)
	}
	logger.Debug("Generating connection string", args...)

	encrypt := dsInfo.JsonData.Encrypt
	tlsSkipVerify := dsInfo.JsonData.TlsSkipVerify
	hostNameInCertificate := dsInfo.JsonData.Servername
	certificate := dsInfo.JsonData.RootCertFile
	connStr := fmt.Sprintf("server=%s;database=%s;user id=%s;password=%s;",
		addr.Host,
		dsInfo.Database,
		dsInfo.User,
		dsInfo.DecryptedSecureJSONData["password"],
	)
	// Port number 0 means to determine the port automatically, so we can let the driver choose
	if addr.Port != "0" {
		connStr += fmt.Sprintf("port=%s;", addr.Port)
	}
	if encrypt == "true" {
		connStr += fmt.Sprintf("encrypt=%s;TrustServerCertificate=%t;", encrypt, tlsSkipVerify)
		if hostNameInCertificate != "" {
			connStr += fmt.Sprintf("hostNameInCertificate=%s;", hostNameInCertificate)
		}

		if certificate != "" {
			connStr += fmt.Sprintf("certificate=%s;", certificate)
		}
	} else if encrypt == "disable" {
		connStr += fmt.Sprintf("encrypt=%s;", dsInfo.JsonData.Encrypt)
	}

	if dsInfo.JsonData.ConnectionTimeout != 0 {
		connStr += fmt.Sprintf("connection timeout=%d;", dsInfo.JsonData.ConnectionTimeout)
	}

	return connStr, nil
}

type mssqlQueryResultTransformer struct {
	userError string
}

func (t *mssqlQueryResultTransformer) TransformQueryError(logger log.Logger, err error) error {
	// go-mssql overrides source error, so we currently match on string
	// ref https://github.com/denisenkom/go-mssqldb/blob/045585d74f9069afe2e115b6235eb043c8047043/tds.go#L904
	if strings.HasPrefix(strings.ToLower(err.Error()), "unable to open tcp connection with host") {
		logger.Error("Query error", "error", err)
		return sqleng.ErrConnectionFailed.Errorf("failed to connect to server - %s", t.userError)
	}

	return err
}

// CheckHealth pings the connected SQL database
func (s *Service) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	dsHandler, err := s.getDataSourceHandler(ctx, req.PluginContext)
	if err != nil {
		return nil, err
	}

	err = dsHandler.Ping()

	if err != nil {
		return &backend.CheckHealthResult{Status: backend.HealthStatusError, Message: dsHandler.TransformQueryError(logger, err).Error()}, nil
	}

	return &backend.CheckHealthResult{Status: backend.HealthStatusOk, Message: "Database Connection OK"}, nil
}

func (t *mssqlQueryResultTransformer) GetConverterList() []sqlutil.StringConverter {
	return []sqlutil.StringConverter{
		{
			Name:           "handle MONEY",
			InputScanKind:  reflect.Slice,
			InputTypeName:  "MONEY",
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
			Name:           "handle SMALLMONEY",
			InputScanKind:  reflect.Slice,
			InputTypeName:  "SMALLMONEY",
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
			Name:           "handle UNIQUEIDENTIFIER",
			InputScanKind:  reflect.Slice,
			InputTypeName:  "UNIQUEIDENTIFIER",
			ConversionFunc: func(in *string) (*string, error) { return in, nil },
			Replacer: &sqlutil.StringFieldReplacer{
				OutputFieldType: data.FieldTypeNullableString,
				ReplaceFunc: func(in *string) (interface{}, error) {
					if in == nil {
						return nil, nil
					}
					uuid := &mssql.UniqueIdentifier{}
					if err := uuid.Scan([]byte(*in)); err != nil {
						return nil, err
					}
					v := uuid.String()
					return &v, nil
				},
			},
		},
	}
}
