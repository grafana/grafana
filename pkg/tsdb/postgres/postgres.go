package postgres

import (
	"database/sql"
	"fmt"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"xorm.io/core"
)

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "PostgresService",
		InitPriority: registry.Low,
		Instance:     &PostgresService{},
	})
}

type PostgresService struct {
	Cfg        *setting.Cfg `inject:""`
	logger     log.Logger
	tlsManager tlsSettingsProvider
}

func (s *PostgresService) Init() error {
	s.logger = log.New("tsdb.postgres")
	s.tlsManager = newTLSManager(s.logger, s.Cfg.DataPath)
	return nil
}

//nolint: staticcheck // plugins.DataPlugin deprecated
func (s *PostgresService) NewExecutor(datasource *models.DataSource) (plugins.DataPlugin, error) {
	s.logger.Debug("Creating Postgres query endpoint")

	cnnstr, err := s.generateConnectionString(datasource)
	if err != nil {
		return nil, err
	}

	if s.Cfg.Env == setting.Dev {
		s.logger.Debug("getEngine", "connection", cnnstr)
	}

	config := sqleng.DataPluginConfiguration{
		DriverName:        "postgres",
		ConnectionString:  cnnstr,
		Datasource:        datasource,
		MetricColumnTypes: []string{"UNKNOWN", "TEXT", "VARCHAR", "CHAR"},
	}

	queryResultTransformer := postgresQueryResultTransformer{
		log: s.logger,
	}

	timescaledb := datasource.JsonData.Get("timescaledb").MustBool(false)

	plugin, err := sqleng.NewDataPlugin(config, &queryResultTransformer, newPostgresMacroEngine(timescaledb),
		s.logger)
	if err != nil {
		s.logger.Error("Failed connecting to Postgres", "err", err)
		return nil, err
	}

	s.logger.Debug("Successfully connected to Postgres")
	return plugin, nil
}

// escape single quotes and backslashes in Postgres connection string parameters.
func escape(input string) string {
	return strings.ReplaceAll(strings.ReplaceAll(input, `\`, `\\`), "'", `\'`)
}

func (s *PostgresService) generateConnectionString(datasource *models.DataSource) (string, error) {
	var host string
	var port int
	if strings.HasPrefix(datasource.Url, "/") {
		host = datasource.Url
		s.logger.Debug("Generating connection string with Unix socket specifier", "socket", host)
	} else {
		sp := strings.SplitN(datasource.Url, ":", 2)
		host = sp[0]
		if len(sp) > 1 {
			var err error
			port, err = strconv.Atoi(sp[1])
			if err != nil {
				return "", errutil.Wrapf(err, "invalid port in host specifier %q", sp[1])
			}

			s.logger.Debug("Generating connection string with network host/port pair", "host", host, "port", port)
		} else {
			s.logger.Debug("Generating connection string with network host", "host", host)
		}
	}

	connStr := fmt.Sprintf("user='%s' password='%s' host='%s' dbname='%s'",
		escape(datasource.User), escape(datasource.DecryptedPassword()), escape(host), escape(datasource.Database))
	if port > 0 {
		connStr += fmt.Sprintf(" port=%d", port)
	}

	tlsSettings, err := s.tlsManager.getTLSSettings(datasource)
	if err != nil {
		return "", err
	}

	connStr += fmt.Sprintf(" sslmode='%s'", escape(tlsSettings.Mode))

	// Attach root certificate if provided
	// Attach root certificate if provided
	if tlsSettings.RootCertFile != "" {
		s.logger.Debug("Setting server root certificate", "tlsRootCert", tlsSettings.RootCertFile)
		connStr += fmt.Sprintf(" sslrootcert='%s'", escape(tlsSettings.RootCertFile))
	}

	// Attach client certificate and key if both are provided
	if tlsSettings.CertFile != "" && tlsSettings.CertKeyFile != "" {
		s.logger.Debug("Setting TLS/SSL client auth", "tlsCert", tlsSettings.CertFile, "tlsKey", tlsSettings.CertKeyFile)
		connStr += fmt.Sprintf(" sslcert='%s' sslkey='%s'", escape(tlsSettings.CertFile), escape(tlsSettings.CertKeyFile))
	} else if tlsSettings.CertFile != "" || tlsSettings.CertKeyFile != "" {
		return "", fmt.Errorf("TLS/SSL client certificate and key must both be specified")
	}

	s.logger.Debug("Generated Postgres connection string successfully")
	return connStr, nil
}

type postgresQueryResultTransformer struct {
	log log.Logger
}

func (t *postgresQueryResultTransformer) TransformQueryResult(columnTypes []*sql.ColumnType, rows *core.Rows) (
	plugins.DataRowValues, error) {
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
