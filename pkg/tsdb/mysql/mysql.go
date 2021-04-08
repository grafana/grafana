package mysql

import (
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/VividCortex/mysqlerr"
	"github.com/davecgh/go-spew/spew"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/data/sqlutil"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/go-sql-driver/mysql"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"xorm.io/core"
)

const (
	dateFormat     = "2006-01-02"
	dateTimeFormat = "2006-01-02 15:04:05"
)

func characterEscape(s string, escapeChar string) string {
	return strings.ReplaceAll(s, escapeChar, url.QueryEscape(escapeChar))
}

func NewExecutor(datasource *models.DataSource) (plugins.DataPlugin, error) {
	logger := log.New("tsdb.mysql")

	protocol := "tcp"
	if strings.HasPrefix(datasource.Url, "/") {
		protocol = "unix"
	}

	cnnstr := fmt.Sprintf("%s:%s@%s(%s)/%s?collation=utf8mb4_unicode_ci&parseTime=true&loc=UTC&allowNativePasswords=true",
		characterEscape(datasource.User, ":"),
		datasource.DecryptedPassword(),
		protocol,
		characterEscape(datasource.Url, ")"),
		characterEscape(datasource.Database, "?"),
	)

	tlsConfig, err := datasource.GetTLSConfig()
	if err != nil {
		return nil, err
	}

	if tlsConfig.RootCAs != nil || len(tlsConfig.Certificates) > 0 {
		tlsConfigString := fmt.Sprintf("ds%d", datasource.Id)
		if err := mysql.RegisterTLSConfig(tlsConfigString, tlsConfig); err != nil {
			return nil, err
		}
		cnnstr += "&tls=" + tlsConfigString
	}

	if setting.Env == setting.Dev {
		logger.Debug("getEngine", "connection", cnnstr)
	}

	config := sqleng.DataPluginConfiguration{
		DriverName:        "mysql",
		ConnectionString:  cnnstr,
		Datasource:        datasource,
		TimeColumnNames:   []string{"time", "time_sec"},
		MetricColumnTypes: []string{"CHAR", "VARCHAR", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT"},
	}

	rowTransformer := mysqlQueryResultTransformer{
		log: logger,
	}

	return sqleng.NewDataPlugin(config, &rowTransformer, newMysqlMacroEngine(logger), logger)
}

type mysqlQueryResultTransformer struct {
	log log.Logger
}

// converter map to be implemented here
func (t *mysqlQueryResultTransformer) TransformQueryResult(columnTypes []*sql.ColumnType, rows *core.Rows) (
	plugins.DataRowValues, error) {
	values := make([]interface{}, len(columnTypes))

	for i := range values {
		scanType := columnTypes[i].ScanType()
		values[i] = reflect.New(scanType).Interface()

		if columnTypes[i].DatabaseTypeName() == "BIT" {
			values[i] = new([]byte)
		}
	}

	if err := rows.Scan(values...); err != nil {
		return nil, err
	}

	for i := 0; i < len(columnTypes); i++ {
		typeName := reflect.ValueOf(values[i]).Type().String()

		switch typeName {
		case "*sql.RawBytes":
			values[i] = string(*values[i].(*sql.RawBytes))
		case "*mysql.NullTime":
			sqlTime := (*values[i].(*mysql.NullTime))
			if sqlTime.Valid {
				values[i] = sqlTime.Time
			} else {
				values[i] = nil
			}
		case "*sql.NullInt64":
			nullInt64 := (*values[i].(*sql.NullInt64))
			if nullInt64.Valid {
				values[i] = nullInt64.Int64
			} else {
				values[i] = nil
			}
		case "*sql.NullFloat64":
			nullFloat64 := (*values[i].(*sql.NullFloat64))
			if nullFloat64.Valid {
				values[i] = nullFloat64.Float64
			} else {
				values[i] = nil
			}
		}

		if columnTypes[i].DatabaseTypeName() == "DECIMAL" {
			f, err := strconv.ParseFloat(values[i].(string), 64)

			if err == nil {
				values[i] = f
			} else {
				values[i] = nil
			}
		}
	}

	return values, nil
}

func (t *mysqlQueryResultTransformer) TransformQueryError(err error) error {
	var driverErr *mysql.MySQLError
	if errors.As(err, &driverErr) {
		if driverErr.Number != mysqlerr.ER_PARSE_ERROR && driverErr.Number != mysqlerr.ER_BAD_FIELD_ERROR &&
			driverErr.Number != mysqlerr.ER_NO_SUCH_TABLE {
			t.log.Error("query error", "err", err)
			return errQueryFailed
		}
	}

	return err
}

var errQueryFailed = errors.New("query failed - please inspect Grafana server log for details")

// For Driver mysql, we have the list of possible data type:
// https://www.w3schools.com/sql/sql_datatypes.asp#:~:text=In%20MySQL%20there%20are%20three,numeric%2C%20and%20date%20and%20time.
// Since by default, we convert all into String, we need only to handle the Numeric data types

var converterList = []sqlutil.StringConverter{
	{
		Name:           "handle DOUBLE",
		InputScanKind:  reflect.Struct,
		InputTypeName:  "DOUBLE",
		ConversionFunc: func(in *string) (*string, error) { return in, nil },
		Replacer: &sqlutil.StringFieldReplacer{
			OutputFieldType: data.FieldTypeNullableFloat64,
			ReplaceFunc: func(in *string) (interface{}, error) {
				spew.Dump(in)
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
				spew.Dump(in)
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
				spew.Dump(in)
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
				spew.Dump(in)
				if in == nil {
					return nil, nil
				}
				v, err := time.Parse(dateTimeFormat, *in)
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
				spew.Dump(in)
				if in == nil {
					return nil, nil
				}
				v, err := time.Parse(dateFormat, *in)
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
				spew.Dump(in)
				if in == nil {
					return nil, nil
				}
				v, err := time.Parse(dateTimeFormat, *in)
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
				spew.Dump(in)
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
				spew.Dump(in)
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
}

func (t *mysqlQueryResultTransformer) GetConverterList() []sqlutil.StringConverter {
	return converterList
}
