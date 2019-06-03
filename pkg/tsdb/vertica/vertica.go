package vertica

import (
	"database/sql"
	"net/url"
	"strconv"

	"github.com/go-xorm/core"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"

	_ "github.com/vertica/vertica-sql-go"
)

func newVerticaQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	logger := log.New("tsdb.vertica")

	cnnstr := generateConnectionString(datasource)
	logger.Debug("getEngine", "connection", cnnstr)

	config := tsdb.SqlQueryEndpointConfiguration{
		DriverName:        "vertica",
		ConnectionString:  cnnstr,
		Datasource:        datasource,
		MetricColumnTypes: []string{"UNKNOWN", "TEXT", "VARCHAR", "CHAR"},
	}

	// log.Info("vertica connection string: %v", cnnstr)

	rowTransformer := verticaRowTransformer{
		log: logger,
	}

	timescaledb := datasource.JsonData.Get("timescaledb").MustBool(false)

	return tsdb.NewSqlQueryEndpoint(&config, &rowTransformer, newVerticaMacroEngine(timescaledb), logger)
}

func generateConnectionString(datasource *models.DataSource) string {
	password := ""
	for key, value := range datasource.SecureJsonData.Decrypt() {
		if key == "password" {
			password = value
			break
		}
	}

	tlsMode := datasource.JsonData.Get("tlsmode").MustString("none")
	interp := datasource.JsonData.Get("usePreparedStatements").MustBool(true)
	var interpStr string
	if interp {
		interpStr = "1"
	} else {
		interpStr = "0"
	}

	u := &url.URL{
		Scheme: "vertica",
		User:   url.UserPassword(datasource.User, password),
		Host:   datasource.Url, Path: datasource.Database,
		RawQuery: "tlsmode=" + url.QueryEscape(tlsMode) + "&use_prepared_statements=" + url.QueryEscape(interpStr),
	}

	return u.String()
}

type verticaRowTransformer struct {
	log log.Logger
}

func (t *verticaRowTransformer) Transform(columnTypes []*sql.ColumnType, rows *core.Rows) (tsdb.RowValues, error) {
	values := make([]interface{}, len(columnTypes))
	valuePtrs := make([]interface{}, len(columnTypes))

	for i := 0; i < len(columnTypes); i++ {
		valuePtrs[i] = &values[i]
	}

	if err := rows.Scan(valuePtrs...); err != nil {
		return nil, err
	}

	// convert types not handled by lib/pq
	// unhandled types are returned as []byte
	for i := 0; i < len(columnTypes); i++ {
		if value, ok := values[i].([]byte); ok {
			switch columnTypes[i].DatabaseTypeName() {
			case "NUMERIC":
				if v, err := strconv.ParseFloat(string(value), 64); err == nil {
					values[i] = v
				} else {
					t.log.Debug("Rows", "Error converting numeric to float", value)
				}
			case "UNKNOWN", "CIDR", "INET", "MACADDR":
				// char literals have type UNKNOWN
				values[i] = string(value)
			default:
				t.log.Error("Rows", "Unknown database type", columnTypes[i].DatabaseTypeName(), "value", value)
				values[i] = string(value)
			}
		}
	}

	return values, nil
}

func init() {
	tsdb.RegisterTsdbQueryEndpoint("vertica", newVerticaQueryEndpoint)
}
