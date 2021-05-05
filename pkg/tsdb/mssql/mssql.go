package mssql

import (
	"fmt"
	"net/url"
	"reflect"
	"regexp"
	"strconv"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"

	mssql "github.com/denisenkom/go-mssqldb"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

var logger = log.New("tsdb.mssql")

//nolint: staticcheck // plugins.DataPlugin deprecated
func NewExecutor(datasource *models.DataSource) (plugins.DataPlugin, error) {
	cnnstr, err := generateConnectionString(datasource)
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
		Datasource:        datasource,
		MetricColumnTypes: []string{"VARCHAR", "CHAR", "NVARCHAR", "NCHAR"},
	}

	queryResultTransformer := mssqlQueryResultTransformer{
		log: logger,
	}

	return sqleng.NewDataPlugin(config, &queryResultTransformer, newMssqlMacroEngine(), logger)
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

func generateConnectionString(dataSource *models.DataSource) (string, error) {
	const dfltPort = "0"
	var addr util.NetworkAddress
	if dataSource.Url != "" {
		u, err := ParseURL(dataSource.Url)
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
		"url", dataSource.Url, "host", addr.Host,
	}
	if addr.Port != "0" {
		args = append(args, "port", addr.Port)
	}

	logger.Debug("Generating connection string", args...)
	encrypt := dataSource.JsonData.Get("encrypt").MustString("false")
	connStr := fmt.Sprintf("server=%s;database=%s;user id=%s;password=%s;",
		addr.Host,
		dataSource.Database,
		dataSource.User,
		dataSource.DecryptedPassword(),
	)
	// Port number 0 means to determine the port automatically, so we can let the driver choose
	if addr.Port != "0" {
		connStr += fmt.Sprintf("port=%s;", addr.Port)
	}
	if encrypt != "false" {
		connStr += fmt.Sprintf("encrypt=%s;", encrypt)
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
