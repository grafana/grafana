package postgres

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"xorm.io/core"
)

func init() {
	tsdb.RegisterTsdbQueryEndpoint("postgres", newPostgresQueryEndpoint)
}

func newPostgresQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	logger := log.New("tsdb.postgres")
	logger.Debug("Creating Postgres query endpoint")

	cnnstr, err := generateConnectionString(datasource, logger)
	if err != nil {
		return nil, err
	}

	if setting.Env == setting.Dev {
		logger.Debug("getEngine", "connection", cnnstr)
	}

	config := sqleng.SqlQueryEndpointConfiguration{
		DriverName:        "postgres",
		ConnectionString:  cnnstr,
		Datasource:        datasource,
		MetricColumnTypes: []string{"UNKNOWN", "TEXT", "VARCHAR", "CHAR"},
	}

	queryResultTransformer := postgresQueryResultTransformer{
		log: logger,
	}

	timescaledb := datasource.JsonData.Get("timescaledb").MustBool(false)

	endpoint, err := sqleng.NewSqlQueryEndpoint(&config, &queryResultTransformer, newPostgresMacroEngine(timescaledb), logger)
	if err != nil {
		logger.Debug("Failed connecting to Postgres", "err", err)
		return nil, err
	}

	logger.Debug("Successfully connected to Postgres")
	return endpoint, err
}

// escape single quotes and backslashes in Postgres connection string parameters.
func escape(input string) string {
	return strings.ReplaceAll(strings.ReplaceAll(input, `\`, `\\`), "'", `\'`)
}

func generateConnectionString(datasource *models.DataSource, logger log.Logger) (string, error) {
	tlsMode := strings.TrimSpace(strings.ToLower(datasource.JsonData.Get("sslmode").MustString("verify-full")))
	isTLSDisabled := tlsMode == "disable"

	var host string
	var port int
	if strings.HasPrefix(datasource.Url, "/") {
		host = datasource.Url
		logger.Debug("Generating connection string with Unix socket specifier", "socket", host)
	} else {
		sp := strings.SplitN(datasource.Url, ":", 2)
		host = sp[0]
		if len(sp) > 1 {
			var err error
			port, err = strconv.Atoi(sp[1])
			if err != nil {
				return "", errutil.Wrapf(err, "invalid port in host specifier %q", sp[1])
			}

			logger.Debug("Generating connection string with network host/port pair", "host", host, "port", port)
		} else {
			logger.Debug("Generating connection string with network host", "host", host)
		}
	}

	connStr := fmt.Sprintf("user='%s' password='%s' host='%s' dbname='%s' sslmode='%s'",
		escape(datasource.User), escape(datasource.DecryptedPassword()), escape(host), escape(datasource.Database),
		escape(tlsMode))
	if port > 0 {
		connStr += fmt.Sprintf(" port=%d", port)
	}
	if isTLSDisabled {
		logger.Debug("Postgres TLS/SSL is disabled")
	} else {
		logger.Debug("Postgres TLS/SSL is enabled", "tlsMode", tlsMode)

		// Attach root certificate if provided
		if tlsRootCert := datasource.JsonData.Get("sslRootCertFile").MustString(""); tlsRootCert != "" {
			logger.Debug("Setting server root certificate", "tlsRootCert", tlsRootCert)
			connStr += fmt.Sprintf(" sslrootcert='%s'", tlsRootCert)
		}

		// Attach client certificate and key if both are provided
		tlsCert := datasource.JsonData.Get("sslCertFile").MustString("")
		tlsKey := datasource.JsonData.Get("sslKeyFile").MustString("")
		if tlsCert != "" && tlsKey != "" {
			logger.Debug("Setting TLS/SSL client auth", "tlsCert", tlsCert, "tlsKey", tlsKey)
			connStr += fmt.Sprintf(" sslcert='%s' sslkey='%s'", tlsCert, tlsKey)
		} else if tlsCert != "" || tlsKey != "" {
			return "", fmt.Errorf("TLS/SSL client certificate and key must both be specified")
		}
	}

	logger.Debug("Generated Postgres connection string successfully")
	return connStr, nil
}

type postgresQueryResultTransformer struct {
	log log.Logger
}

func (t *postgresQueryResultTransformer) TransformQueryResult(columnTypes []*sql.ColumnType, rows *core.Rows) (tsdb.RowValues, error) {
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

func (t *postgresQueryResultTransformer) TransformQueryError(err error) error {
	return err
}
