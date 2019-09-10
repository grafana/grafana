package mssql

import (
	"database/sql"
	"fmt"
	"net/url"
	"strconv"

	"github.com/grafana/grafana/pkg/setting"

	_ "github.com/denisenkom/go-mssqldb"
	"github.com/go-xorm/core"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"github.com/grafana/grafana/pkg/util"
)

func init() {
	tsdb.RegisterTsdbQueryEndpoint("mssql", newMssqlQueryEndpoint)
}

func newMssqlQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	logger := log.New("tsdb.mssql")

	cnnstr := generateConnectionString(datasource)
	if setting.Env == setting.DEV {
		logger.Debug("getEngine", "connection", cnnstr)
	}

	config := sqleng.SqlQueryEndpointConfiguration{
		DriverName:        "mssql",
		ConnectionString:  cnnstr,
		Datasource:        datasource,
		MetricColumnTypes: []string{"VARCHAR", "CHAR", "NVARCHAR", "NCHAR"},
	}

	rowTransformer := mssqlRowTransformer{
		log: logger,
	}

	return sqleng.NewSqlQueryEndpoint(&config, &rowTransformer, newMssqlMacroEngine(), logger)
}

func generateConnectionString(datasource *models.DataSource) string {
	server, port := util.SplitHostPortDefault(datasource.Url, "localhost", "1433")
	encrypt := datasource.JsonData.Get("encrypt").MustString("false")

	query := url.Values{}
	query.Add("database", datasource.Database)
	query.Add("encrypt", encrypt)

	u := &url.URL{
		Scheme:   "sqlserver",
		User:     url.UserPassword(datasource.User, datasource.DecryptedPassword()),
		Host:     fmt.Sprintf("%s:%s", server, port),
		RawQuery: query.Encode(),
	}
	return u.String()
}

type mssqlRowTransformer struct {
	log log.Logger
}

func (t *mssqlRowTransformer) Transform(columnTypes []*sql.ColumnType, rows *core.Rows) (tsdb.RowValues, error) {
	values := make([]interface{}, len(columnTypes))
	valuePtrs := make([]interface{}, len(columnTypes))

	for i, stype := range columnTypes {
		t.log.Debug("type", "type", stype)
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
			default:
				t.log.Debug("Rows", "Unknown database type", columnTypes[i].DatabaseTypeName(), "value", value)
				values[i] = string(value)
			}
		}
	}

	return values, nil
}
