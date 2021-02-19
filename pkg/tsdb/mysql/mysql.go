package mysql

import (
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"reflect"
	"strconv"
	"strings"

	"github.com/VividCortex/mysqlerr"
	"github.com/grafana/grafana/pkg/setting"

	"github.com/go-sql-driver/mysql"
	"github.com/go-xorm/core"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
)

func init() {
	tsdb.RegisterTsdbQueryEndpoint("mysql", newMysqlQueryEndpoint)
}

func characterEscape(s string, escapeChar string) string {
	return strings.Replace(s, escapeChar, url.QueryEscape(escapeChar), -1)
}

func newMysqlQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
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

	if setting.Env == setting.DEV {
		logger.Debug("getEngine", "connection", cnnstr)
	}

	config := sqleng.SqlQueryEndpointConfiguration{
		DriverName:        "mysql",
		ConnectionString:  cnnstr,
		Datasource:        datasource,
		TimeColumnNames:   []string{"time", "time_sec"},
		MetricColumnTypes: []string{"CHAR", "VARCHAR", "TINYTEXT", "TEXT", "MEDIUMTEXT", "LONGTEXT"},
	}

	rowTransformer := mysqlQueryResultTransformer{
		log: logger,
	}

	return sqleng.NewSqlQueryEndpoint(&config, &rowTransformer, newMysqlMacroEngine(logger), logger)
}

type mysqlQueryResultTransformer struct {
	log log.Logger
}

func (t *mysqlQueryResultTransformer) TransformQueryResult(columnTypes []*sql.ColumnType, rows *core.Rows) (tsdb.RowValues, error) {
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
	if driverErr, ok := err.(*mysql.MySQLError); ok {
		if driverErr.Number != mysqlerr.ER_PARSE_ERROR && driverErr.Number != mysqlerr.ER_BAD_FIELD_ERROR && driverErr.Number != mysqlerr.ER_NO_SUCH_TABLE {
			t.log.Error("query error", "err", err)
			return errQueryFailed
		}
	}

	return err
}

var errQueryFailed = errors.New("Query failed. Please inspect Grafana server log for details")
