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

func databaseConnection(datasource *models.DataSource, logger log.Logger) (tsdb.TsdbQueryEndpoint, error) {
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

func newPostgresQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	logger := log.New("tsdb.postgres")
	logger.Debug("Creating Postgres query endpoint")
	endpoint, err := databaseConnection(datasource, logger)
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

func writeConnectionFile(
	ds *models.DataSource, fileContent string, currentPath string, certFileName string, jsonFieldName string) error {
	var generatedFilePath string
	if ssljs, ok := ds.JsonData.CheckGet(jsonFieldName); ok {
		generatedFilePath = ssljs.MustString("")
	}
	if len(fileContent) > 0 {
		if len(generatedFilePath) == 0 {
			generatedFilePath = filepath.Join(currentPath, certFileName)
		}
		if err := ioutil.WriteFile(generatedFilePath, []byte(fileContent), 0600); err != nil {
			return err
		}
		ds.JsonData.Set(jsonFieldName, generatedFilePath)
	} else {
		if len(generatedFilePath) > 0 {
			if err := os.Remove(generatedFilePath); err != nil {
				return err
			}
		}
		ds.JsonData.Set(jsonFieldName, "")
	}
}

func writeConnectionFiles(ds *models.DataSource, logger log.Logger) error {
	sslMode := strings.TrimSpace(strings.ToLower(ds.JsonData.Get("sslmode").MustString("verify-full")))
	decrypted := ds.SecureJsonData.Decrypt()
	tlsCACert := decrypted["tlsCACert"]
	tlsClientCert := decrypted["tlsClientCert"]
	tlsClientKey := decrypted["tlsClientKey"]

	if sslMode != "disable" {
		// create folder
		currentPath, err := os.Getwd()
		if err != nil {
			return err
		}
		currentPath = filepath.Join(currentPath, ds.Uid+"generatedSSLCerts")
		if _, err := os.Stat(currentPath); os.IsNotExist(err) {
			os.Mkdir(currentPath, 0600)
		}

		// Create/Modify/Delete CA Certification
		err = writeConnectionFile(
			ds, tlsCACert, currentPath, "ca.crt", "generatedSSLRootCertFile")
		if err != nil {
			return err
		}

		err = writeConnectionFile(
			ds, tlsClientCert, currentPath, "client.crt", "generatedSSLCertFile")
		if err != nil {
			return err
		}

		err = writeConnectionFile(
			ds, tlsClientKey, currentPath, "client.key", "generatedSSLKeyFile")
		if err != nil {
			return err
		}

		if len(tlsCACert) == 0 && len(tlsClientCert) == 0 && len(tlsClientKey) == 0 {
			if err := os.Remove(currentPath); err != nil {
				log.Warnf("failed to delete temporary folder generated %v : %v", currentPath, err)
			}
		}
	}
	return nil
}

func generateConnectionString(datasource *models.DataSource, logger log.Logger) (string, error) {
	sslConfigureMethod := strings.TrimSpace(strings.ToLower(datasource.JsonData.Get("sslconfiguremethod").MustString("file-content")))
	sslMode := strings.TrimSpace(strings.ToLower(datasource.JsonData.Get("sslmode").MustString("verify-full")))
	isSSLDisabled := sslMode == "disable"

	if sslConfigureMethod == "file-content" {
		err := writeConnectionFiles(datasource, logger)
		if err != nil {
			return "", err
		}
	}

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
		escape(sslMode))
	if port > 0 {
		connStr += fmt.Sprintf(" port=%d", port)
	}
	if isSSLDisabled {
		logger.Debug("Postgres SSL is disabled")
	} else {
		logger.Debug("Postgres SSL is enabled", "sslMode", sslMode)

		// Manage the backward compatibility for certification settings
		var sslRootCert, sslCert, sslKey string
		if sslConfigureMethod == "file-content" {
			sslRootCert = datasource.JsonData.Get("generatedSSLRootCertFile").MustString("")
			sslCert = datasource.JsonData.Get("generatedSSLCertFile").MustString("")
			sslKey = datasource.JsonData.Get("generatedSSLKeyFile").MustString("")
		} else {
			sslRootCert = datasource.JsonData.Get("sslRootCertFile").MustString("")
			sslCert = datasource.JsonData.Get("sslCertFile").MustString("")
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
			return "", fmt.Errorf("SSL client certificate and key must both be specified")
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
