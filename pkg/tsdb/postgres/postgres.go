package postgres

import (
	"database/sql"
	"fmt"
	"net/url"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/setting"

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

	if setting.Env == setting.DEV {
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

	return sqleng.NewSqlQueryEndpoint(&config, &queryResultTransformer, newPostgresMacroEngine(timescaledb), logger)
}

func generateConnectionString(datasource *models.DataSource, logger log.Logger) (string, error) {
	sslMode := strings.TrimSpace(strings.ToLower(datasource.JsonData.Get("sslmode").MustString("verify-full")))
	isSSLDisabled := sslMode == "disable"

	// Always pass SSL mode
	sslopts := "sslmode=" + url.QueryEscape(sslMode)
	if isSSLDisabled {
		logger.Debug("Postgres SSL is disabled")
	} else {
		logger.Debug("Postgres SSL is not disabled", "sslMode", sslMode)

		// Attach root certificate if provided
		if sslrootcert := datasource.JsonData.Get("sslRootCertFile").MustString(""); sslrootcert != "" {
			logger.Debug("Setting CA certificate", "sslRootCert", sslrootcert)
			sslopts += "&sslrootcert=" + url.QueryEscape(sslrootcert)
		}

		// Attach client certificate and key if both are provided
		sslcert := datasource.JsonData.Get("sslCertFile").MustString("")
		sslkey := datasource.JsonData.Get("sslKeyFile").MustString("")
		if sslcert != "" && sslkey != "" {
			logger.Debug("Setting SSL client auth", "sslcert", sslcert)
			sslopts += "&sslcert=" + url.QueryEscape(sslcert) + "&sslkey=" + url.QueryEscape(sslkey)

		} else if sslcert != "" || sslkey != "" {
			return "", fmt.Errorf("SSL client and certificate must both be specified")
		}
	}

	u := &url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(datasource.User, datasource.DecryptedPassword()),
		Host:   datasource.Url, Path: datasource.Database,
		RawQuery: sslopts,
	}

	return u.String(), nil
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
