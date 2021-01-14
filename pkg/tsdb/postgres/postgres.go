package postgres

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
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

func cleanUpFiles(config sslAuthenticationConfig) {
	if config.tmpFilesPath != "" {
		if err := os.RemoveAll(config.tmpFilesPath); err != nil {
			log.Warnf("failed to delete temporary files %v: %v", config.tmpFilesPath, err)
		}
	}
}

func databaseConnection(datasource *models.DataSource, logger log.Logger) (tsdb.TsdbQueryEndpoint, sslAuthenticationConfig, error) {
	cnnstr, sslCertificationCfg, err := generateConnectionString(datasource, logger)
	if err != nil {
		return nil, sslCertificationCfg, err
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
		return nil, sslCertificationCfg, err
	}

	logger.Debug("Successfully connected to Postgres")
	return endpoint, sslCertificationCfg, err
}

func newPostgresQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	logger := log.New("tsdb.postgres")
	logger.Debug("Creating Postgres query endpoint")
	endpoint, sslCertificationCfg, err := databaseConnection(datasource, logger)
	defer cleanUpFiles(sslCertificationCfg)
	return endpoint, err
}

// escape single quotes and backslashes in Postgres connection string parameters.
func escape(input string) string {
	return strings.ReplaceAll(strings.ReplaceAll(input, `\`, `\\`), "'", `\'`)
}

type sslAuthenticationConfig struct {
	sslMode         string
	sslRootCertFile string
	sslCertFile     string
	sslKeyFile      string
	tmpFilesPath    string
}

func writeConnectionFiles(ds *models.DataSource, logger log.Logger) (sslAuthenticationConfig, error) {
	sslMode := strings.TrimSpace(strings.ToLower(ds.JsonData.Get("sslmode").MustString("verify-full")))
	config := sslAuthenticationConfig{}
	config.sslMode = sslMode
	if sslMode != "disable" {
		decrypted := ds.SecureJsonData.Decrypt()
		currentPath, err := os.Getwd()
		if err != nil {
			return config, err
		}
		currentPath, err = ioutil.TempDir(currentPath, "tmpSSLCerts")
		if err != nil {
			return config, err
		}
		config.tmpFilesPath = currentPath

		if len(decrypted["tlsClientCert"]) > 0 {
			clientCertification := filepath.Join(currentPath, "client.crt")
			if err = ioutil.WriteFile(clientCertification, []byte(decrypted["tlsCACert"]), 0600); err != nil {
				return config, err
			}
			config.sslCertFile = clientCertification
		}
		if len(decrypted["tlsClientKey"]) > 0 {
			clientKey := filepath.Join(currentPath, "client.key")
			if err = ioutil.WriteFile(clientKey, []byte(decrypted["tlsClientKey"]), 0600); err != nil {
				return config, err
			}
			config.sslKeyFile = clientKey
		}
		if len(decrypted["tlsCACert"]) > 0 {
			caCert := filepath.Join(currentPath, "ca.crt")
			if err = ioutil.WriteFile(caCert, []byte(decrypted["tlsCACert"]), 0600); err != nil {
				return config, err
			}
			config.sslRootCertFile = caCert
		}
	}
	return config, nil
}

func generateConnectionString(datasource *models.DataSource, logger log.Logger) (string, sslAuthenticationConfig, error) {
	sslCertificationCfg, err := writeConnectionFiles(datasource, logger)
	if err != nil {
		return "", sslCertificationCfg, err
	}
	sslMode := sslCertificationCfg.sslMode
	isSSLDisabled := sslMode == "disable"

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
				return "", sslCertificationCfg, errutil.Wrapf(err, "invalid port in host specifier %q", sp[1])
			}

			logger.Debug("Generating connection string with network host/port pair", "host", host, "port", port)
		} else {
			logger.Debug("Generating connection string with network host", "host", host)
		}
	}

	connStr := fmt.Sprintf("user='%s' password='%s' host='%s' dbname='%s' sslmode='%s'",
		escape(datasource.User), escape(datasource.DecryptedPassword()), escape(host), escape(datasource.Database),
		escape(sslMode))
	if port > 0 {
		connStr += fmt.Sprintf(" port=%d", port)
	}
	if isSSLDisabled {
		logger.Debug("Postgres SSL is disabled")
	} else {
		logger.Debug("Postgres SSL is enabled", "sslMode", sslMode)

		// Manage the backward compatibility for certification settings
		sslRootCert := sslCertificationCfg.sslRootCertFile
		if sslRootCert == "" {
			sslRootCert = datasource.JsonData.Get("sslRootCertFile").MustString("")
		}
		sslCert := sslCertificationCfg.sslCertFile
		if sslCert == "" {
			sslCert = datasource.JsonData.Get("sslCertFile").MustString("")
		}
		sslKey := sslCertificationCfg.sslKeyFile
		if sslKey == "" {
			sslKey = datasource.JsonData.Get("sslKeyFile").MustString("")
		}

		// Attach root certificate if provided
		if sslRootCert != "" {
			logger.Debug("Setting server root certificate", "sslRootCert", sslRootCert)
			connStr += fmt.Sprintf(" sslrootcert='%s'", sslRootCert)
		}

		// Attach client certificate and key if both are provided
		if sslCert != "" && sslKey != "" {
			logger.Debug("Setting SSL client auth", "sslCert", sslCert, "sslKey", sslKey)
			connStr += fmt.Sprintf(" sslcert='%s' sslkey='%s'", sslCert, sslKey)
		} else if sslCert != "" || sslKey != "" {
			return "", sslCertificationCfg, fmt.Errorf("SSL client certificate and key must both be specified")
		}
	}

	logger.Debug("Generated Postgres connection string successfully")
	return connStr, sslCertificationCfg, nil
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
