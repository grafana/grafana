package mssql

import (
	"database/sql"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/setting"

	_ "github.com/denisenkom/go-mssqldb"
	"github.com/go-xorm/core"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"github.com/grafana/grafana/pkg/util"
	"github.com/grafana/grafana/pkg/util/errutil"
)

func init() {
	tsdb.RegisterTsdbQueryEndpoint("mssql", newMssqlQueryEndpoint)
}

func newMssqlQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	logger := log.New("tsdb.mssql")

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

func generateConnectionString(datasource *models.DataSource) (string, error) {
	addr, err := util.SplitHostPortDefault(datasource.Url, "localhost", "1433")
	if err != nil {
		return "", errutil.Wrapf(err, "Invalid data source URL '%s'", datasource.Url)
	}

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
