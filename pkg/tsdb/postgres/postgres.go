package postgres

import (
	"database/sql"
	"github.com/grafana/grafana/pkg/setting"
	"net/url"
	"strconv"

	"github.com/go-xorm/core"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
)

func init() {
	tsdb.RegisterTsdbQueryEndpoint("postgres", newPostgresQueryEndpoint)
}

func newPostgresQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	logger := log.New("tsdb.postgres")

	cnnstr := generateConnectionString(datasource)
	if setting.Env == setting.DEV {
		logger.Debug("getEngine", "connection", cnnstr)
	}

	config := tsdb.SqlQueryEndpointConfiguration{
		DriverName:        "postgres",
		ConnectionString:  cnnstr,
		Datasource:        datasource,
		MetricColumnTypes: []string{"UNKNOWN", "TEXT", "VARCHAR", "CHAR"},
	}

	rowTransformer := postgresRowTransformer{
		log: logger,
	}

	timescaledb := datasource.JsonData.Get("timescaledb").MustBool(false)

	return tsdb.NewSqlQueryEndpoint(&config, &rowTransformer, newPostgresMacroEngine(timescaledb), logger)
}

func generateConnectionString(datasource *models.DataSource) string {
	sslmode := datasource.JsonData.Get("sslmode").MustString("verify-full")
	u := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(datasource.User, datasource.DecryptedPassword()),
		Host:   datasource.Url, Path: datasource.Database,
		RawQuery: "sslmode=" + url.QueryEscape(sslmode),
	}

	return u.String()
}

type postgresRowTransformer struct {
	log log.Logger
}

func (t *postgresRowTransformer) Transform(columnTypes []*sql.ColumnType, rows *core.Rows) (tsdb.RowValues, error) {
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
				t.log.Debug("Rows", "Unknown database type", columnTypes[i].DatabaseTypeName(), "value", value)
				values[i] = string(value)
			}
		}
	}

	return values, nil
}
