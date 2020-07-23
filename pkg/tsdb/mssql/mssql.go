package mssql

import (
	"database/sql"
	"fmt"
	"net/url"
	"regexp"
	"strconv"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"

	mssql "github.com/denisenkom/go-mssqldb"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"xorm.io/core"
)

func init() {
	tsdb.RegisterTsdbQueryEndpoint("mssql", newMssqlQueryEndpoint)
}

var logger = log.New("tsdb.mssql")

func newMssqlQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	cnnstr, err := generateConnectionString(datasource)
	if err != nil {
		return nil, err
	}
	if setting.Env == setting.DEV {
		logger.Debug("getEngine", "connection", cnnstr)
	}

	config := sqleng.SqlQueryEndpointConfiguration{
		DriverName:        "mssql",
		ConnectionString:  cnnstr,
		Datasource:        datasource,
		MetricColumnTypes: []string{"VARCHAR", "CHAR", "NVARCHAR", "NCHAR"},
	}

	queryResultTransformer := mssqlQueryResultTransformer{
		log: logger,
	}

	return sqleng.NewSqlQueryEndpoint(&config, &queryResultTransformer, newMssqlMacroEngine(), logger)
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

func generateConnectionString(datasource *models.DataSource) (string, error) {
	var addr util.NetworkAddress
	if datasource.Url != "" {
		u, err := ParseURL(datasource.Url)
		if err != nil {
			return "", err
		}
		addr, err = util.SplitHostPortDefault(u.Host, "localhost", "1433")
		if err != nil {
			return "", err
		}
	} else {
		addr = util.NetworkAddress{
			Host: "localhost",
			Port: "1433",
		}
	}

	logger.Debug("Generating connection string", "url", datasource.Url, "host", addr.Host, "port", addr.Port)
	encrypt := datasource.JsonData.Get("encrypt").MustString("false")
	connStr := fmt.Sprintf("server=%s;port=%s;database=%s;user id=%s;password=%s;",
		addr.Host,
		addr.Port,
		datasource.Database,
		datasource.User,
		datasource.DecryptedPassword(),
	)
	if encrypt != "false" {
		connStr += fmt.Sprintf("encrypt=%s;", encrypt)
	}
	return connStr, nil
}

type mssqlQueryResultTransformer struct {
	log log.Logger
}

func (t *mssqlQueryResultTransformer) TransformQueryResult(columnTypes []*sql.ColumnType, rows *core.Rows) (tsdb.RowValues, error) {
	values := make([]interface{}, len(columnTypes))
	valuePtrs := make([]interface{}, len(columnTypes))

	for i := range columnTypes {
		// debug output on large tables causes high memory utilization/leak
		// t.log.Debug("type", "type", stype)
		valuePtrs[i] = &values[i]
	}

	if err := rows.Scan(valuePtrs...); err != nil {
		return nil, err
	}

	// convert types not handled by denisenkom/go-mssqldb
	// unhandled types are returned as []byte
	for i := 0; i < len(columnTypes); i++ {
		if value, ok := values[i].([]byte); ok {
			switch columnTypes[i].DatabaseTypeName() {
			case "MONEY", "SMALLMONEY", "DECIMAL":
				if v, err := strconv.ParseFloat(string(value), 64); err == nil {
					values[i] = v
				} else {
					t.log.Debug("Rows", "Error converting numeric to float", value)
				}
			case "UNIQUEIDENTIFIER":
				uuid := &mssql.UniqueIdentifier{}
				if err := uuid.Scan(value); err == nil {
					values[i] = uuid.String()
				} else {
					t.log.Debug("Rows", "Error converting uniqueidentifier to string", value)
				}
			default:
				t.log.Debug("Rows", "Unknown database type", columnTypes[i].DatabaseTypeName(), "value", value)
				values[i] = string(value)
			}
		}
	}

	return values, nil
}

func (t *mssqlQueryResultTransformer) TransformQueryError(err error) error {
	return err
}
