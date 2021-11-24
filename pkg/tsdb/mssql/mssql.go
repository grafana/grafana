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

	mssql "github.com/denisenkom/go-mssqldb"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"github.com/grafana/grafana/pkg/util"
)

var logger = log.New("tsdb.mssql")

const pluginID = "mssql"

type Service struct {
	im instancemgmt.InstanceManager
}

func ProvideService(cfg *setting.Cfg, pluginStore plugins.Store) (*Service, error) {
	s := &Service{
		im: datasource.NewInstanceManager(newInstanceSettings(cfg)),
	}
	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: s,
	})

	resolver := plugins.CoreBackendPluginPathResolver(cfg, pluginID)
	if err := pluginStore.AddWithFactory(context.Background(), pluginID, factory, resolver); err != nil {
		logger.Error("Failed to register plugin", "error", err)
	}
	return s, nil
}

func (s *Service) getDataSourceHandler(pluginCtx backend.PluginContext) (*sqleng.DataSourceHandler, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(*sqleng.DataSourceHandler)
	return instance, nil
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	dsHandler, err := s.getDataSourceHandler(req.PluginContext)
	if err != nil {
		return nil, err
	}
	return dsHandler.QueryData(ctx, req)
}

func newInstanceSettings(cfg *setting.Cfg) datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		jsonData := sqleng.JsonData{
			MaxOpenConns:    0,
			MaxIdleConns:    2,
			ConnMaxLifetime: 14400,
			Encrypt:         "false",
		}

		err := json.Unmarshal(settings.JSONData, &jsonData)
		if err != nil {
			return nil, fmt.Errorf("error reading settings: %w", err)
		}
		dsInfo := sqleng.DataSourceInfo{
			JsonData:                jsonData,
			URL:                     settings.URL,
			User:                    settings.User,
			Database:                settings.Database,
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
			logger.Debug("getEngine", "connection", cnnstr)
		}

		config := sqleng.DataPluginConfiguration{
			DriverName:        "mssql",
			ConnectionString:  cnnstr,
			DSInfo:            dsInfo,
			MetricColumnTypes: []string{"VARCHAR", "CHAR", "NVARCHAR", "NCHAR"},
			RowLimit:          cfg.DataProxyRowLimit,
		}

		queryResultTransformer := mssqlQueryResultTransformer{
			log: logger,
		}

		return sqleng.NewQueryDataHandler(config, &queryResultTransformer, newMssqlMacroEngine(), logger)
	}
}

// ParseURL tries to parse an MSSQL URL string into a URL object.
func ParseURL(u string) (*url.URL, error) {
	logger.Debug("Parsing MSSQL URL", "url", u)

	// Recognize ODBC connection strings like host\instance:1234
	reODBC := regexp.MustCompile(`^[^\\:]+(?:\\[^:]+)?(?::\d+)?$`)
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

	if dsInfo.JsonData.Encrypt == "" {
		dsInfo.JsonData.Encrypt = "false"
	}

	if dsInfo.JsonData.Encrypt != "false" {
		connStr += fmt.Sprintf("encrypt=%s;", dsInfo.JsonData.Encrypt)
	}
	return connStr, nil
}

type mssqlQueryResultTransformer struct {
	log log.Logger
}

func (t *mssqlQueryResultTransformer) TransformQueryError(err error) error {
	// go-mssql overrides source error, so we currently match on string
	// ref https://github.com/denisenkom/go-mssqldb/blob/045585d74f9069afe2e115b6235eb043c8047043/tds.go#L904
	if strings.HasPrefix(strings.ToLower(err.Error()), "unable to open tcp connection with host") {
		t.log.Error("query error", "err", err)
		return sqleng.ErrConnectionFailed
	}

	return err
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
