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

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/datasource"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/coreplugin"
	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"

	mssql "github.com/denisenkom/go-mssqldb"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

var logger = log.New("tsdb.mssql")

func init() {
	registry.Register(&registry.Descriptor{Instance: &Service{}})
}

type Service struct {
	BackendPluginManager backendplugin.Manager `inject:""`
	im                   instancemgmt.InstanceManager
}

func (s *Service) Init() error {
	s.im = datasource.NewInstanceManager(newInstanceSettings())
	factory := coreplugin.New(backend.ServeOpts{
		QueryDataHandler: s,
	})

	if err := s.BackendPluginManager.Register("mysql", factory); err != nil {
		logger.Error("Failed to register plugin", "error", err)
	}
	return nil
}

func (s *Service) getDSInfo(pluginCtx backend.PluginContext) (*sqleng.DataSourceHandler, error) {
	i, err := s.im.Get(pluginCtx)
	if err != nil {
		return nil, err
	}
	instance := i.(sqleng.DataSourceHandler)
	return &instance, nil
}

func (s *Service) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	dsInfo, err := s.getDSInfo(req.PluginContext)
	if err != nil {
		return nil, err
	}
	return dsInfo.QueryData(ctx, req)
}

func newInstanceSettings() datasource.InstanceFactoryFunc {
	return func(settings backend.DataSourceInstanceSettings) (instancemgmt.Instance, error) {
		cnnstr, err := generateConnectionString(settings)
		if err != nil {
			return nil, err
		}
		// TODO: Don't use global
		if setting.Env == setting.Dev {
			logger.Debug("getEngine", "connection", cnnstr)
		}

		config := sqleng.DataPluginConfiguration{
			DriverName:        "mssql",
			ConnectionString:  cnnstr,
			Datasource:        &settings,
			MetricColumnTypes: []string{"VARCHAR", "CHAR", "NVARCHAR", "NCHAR"},
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

func generateConnectionString(settings backend.DataSourceInstanceSettings) (string, error) {
	const dfltPort = "0"
	var addr util.NetworkAddress
	if settings.URL != "" {
		u, err := ParseURL(settings.URL)
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
		"url", settings.URL, "host", addr.Host,
	}
	if addr.Port != "0" {
		args = append(args, "port", addr.Port)
	}

	logger.Debug("Generating connection string", args...)
	type JsonData struct {
		encrypt string `json:"encrypt"`
	}
	jsonData := JsonData{encrypt: "false"}
	err := json.Unmarshal(settings.JSONData, &jsonData)
	if err != nil {
		return "", fmt.Errorf("error reading settings: %w", err)
	}
	connStr := fmt.Sprintf("server=%s;database=%s;user id=%s;password=%s;",
		addr.Host,
		settings.Database,
		settings.User,
		settings.DecryptedSecureJSONData["password"],
	)
	// Port number 0 means to determine the port automatically, so we can let the driver choose
	if addr.Port != "0" {
		connStr += fmt.Sprintf("port=%s;", addr.Port)
	}
	if jsonData.encrypt != "false" {
		connStr += fmt.Sprintf("encrypt=%s;", jsonData.encrypt)
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
