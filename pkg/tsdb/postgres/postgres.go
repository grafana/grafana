package postgres

import (
	"database/sql"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"

	"github.com/alibaba/pouch/pkg/kmutex"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/tsdb"
	"github.com/grafana/grafana/pkg/tsdb/sqleng"
	"xorm.io/core"
)

var validateCertFunc = validateCertFilePaths

func init() {
	registry.Register(&registry.Descriptor{
		Name:         "PostgresService",
		InitPriority: registry.Low,
		Instance:     &postgresService{},
	})
}

type postgresService struct {
	Cfg *setting.Cfg `inject:""`

	mtx    *kmutex.KMutex
	logger log.Logger
}

func (s *postgresService) Init() error {
	s.logger = log.New("tsdb.postgres")
	s.mtx = kmutex.New()
	tsdb.RegisterTsdbQueryEndpoint("postgres", func(ds *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
		return s.newPostgresQueryEndpoint(ds)
	})
	return nil
}

func (s *postgresService) newPostgresQueryEndpoint(datasource *models.DataSource) (tsdb.TsdbQueryEndpoint, error) {
	s.logger.Debug("Creating Postgres query endpoint")

	cnnstr, err := s.generateConnectionString(datasource)
	if err != nil {
		return nil, err
	}

	if s.Cfg.Env == setting.Dev {
		s.logger.Debug("getEngine", "connection", cnnstr)
	}

	config := sqleng.SqlQueryEndpointConfiguration{
		DriverName:        "postgres",
		ConnectionString:  cnnstr,
		Datasource:        datasource,
		MetricColumnTypes: []string{"UNKNOWN", "TEXT", "VARCHAR", "CHAR"},
	}

	queryResultTransformer := postgresQueryResultTransformer{
		log: s.logger,
	}

	timescaledb := datasource.JsonData.Get("timescaledb").MustBool(false)

	endpoint, err := sqleng.NewSqlQueryEndpoint(&config, &queryResultTransformer, newPostgresMacroEngine(timescaledb),
		s.logger)
	if err != nil {
		s.logger.Error("Failed connecting to Postgres", "err", err)
		return nil, err
	}

	s.logger.Debug("Successfully connected to Postgres")
	return endpoint, err
}

// escape single quotes and backslashes in Postgres connection string parameters.
func escape(input string) string {
	return strings.ReplaceAll(strings.ReplaceAll(input, `\`, `\\`), "'", `\'`)
}

type certFileType int

const (
	rootCert = iota
	clientCert
	clientKey
)

func (t certFileType) String() string {
	switch t {
	case rootCert:
		return "root certificate"
	case clientCert:
		return "client certificate"
	case clientKey:
		return "client key"
	default:
		panic(fmt.Sprintf("Unrecognized certFileType %d", t))
	}
}

// writeCertFile writes a certificate file.
func (s *postgresService) writeCertFile(
	ds *models.DataSource, fileContent, dataDir string, fileType certFileType) (string, error) {
	var filename string
	switch fileType {
	case rootCert:
		filename = "root.crt"
	case clientCert:
		filename = "client.crt"
	case clientKey:
		filename = "client.key"
	default:
		panic(fmt.Sprintf("unrecognized certFileType %s", fileType.String()))
	}
	generatedFilePath := filepath.Join(dataDir, filename)
	fileContent = strings.TrimSpace(fileContent)
	if fileContent != "" {
		s.logger.Debug("Writing cert file", "path", generatedFilePath)
		if err := ioutil.WriteFile(generatedFilePath, []byte(fileContent), 0600); err != nil {
			return generatedFilePath, err
		}
		// Make sure the file has the permissions expected by the Postgresql driver, otherwise it will bail
		if err := os.Chmod(generatedFilePath, 0600); err != nil {
			return generatedFilePath, err
		}
		return generatedFilePath, nil
	}

	s.logger.Debug("Deleting cert file since no content is provided", "path", generatedFilePath)
	exists, err := fs.Exists(generatedFilePath)
	if err != nil {
		return generatedFilePath, err
	}
	if exists {
		if err := os.Remove(generatedFilePath); err != nil {
			return generatedFilePath, fmt.Errorf("failed to remove %q: %w", generatedFilePath, err)
		}
	}
	return "", nil
}

func (s *postgresService) writeCertFiles(ds *models.DataSource) (string, string, string, error) {
	s.logger.Debug("Writing TLS certificate files to disk")
	decrypted := ds.SecureJsonData.Decrypt()
	tlsRootCert := decrypted["tlsCACert"]
	tlsClientCert := decrypted["tlsClientCert"]
	tlsClientKey := decrypted["tlsClientKey"]

	var tlsRootCertPath, tlsClientCertPath, tlsKeyPath string
	if tlsRootCert == "" && tlsClientCert == "" && tlsClientKey == "" {
		s.logger.Debug("No TLS/SSL certificates provided")
	}

	s.mtx.Lock(strconv.Itoa(int(ds.Id)))
	defer s.mtx.Unlock(strconv.Itoa(int(ds.Id)))

	workDir := filepath.Join(s.Cfg.DataPath, "tls", ds.Uid+"generatedTLSCerts")
	exists, err := fs.Exists(workDir)
	if err != nil {
		return tlsRootCertPath, tlsClientCertPath, tlsKeyPath, err
	}
	if !exists {
		if err := os.MkdirAll(workDir, 0700); err != nil {
			return tlsRootCertPath, tlsClientCertPath, tlsKeyPath, err
		}
	}

	if tlsRootCertPath, err = s.writeCertFile(ds, tlsRootCert, workDir, rootCert); err != nil {
		return tlsRootCertPath, tlsClientCertPath, tlsKeyPath, err
	}
	if tlsClientCertPath, err = s.writeCertFile(ds, tlsClientCert, workDir, clientCert); err != nil {
		return tlsRootCertPath, tlsClientCertPath, tlsKeyPath, err
	}
	if tlsKeyPath, err = s.writeCertFile(ds, tlsClientKey, workDir, clientKey); err != nil {
		return tlsRootCertPath, tlsClientCertPath, tlsKeyPath, err
	}

	return tlsRootCertPath, tlsClientCertPath, tlsKeyPath, nil
}

// validateCertFilePaths validates configured certificate file paths.
func validateCertFilePaths(rootCert, clientCert, clientKey string) error {
	for _, fpath := range []string{rootCert, clientCert, clientKey} {
		if fpath == "" {
			continue
		}
		exists, err := fs.Exists(fpath)
		if err != nil {
			return err
		}
		if !exists {
			return fmt.Errorf("certificate file %q doesn't exist", fpath)
		}
	}
	return nil
}

func (s *postgresService) generateConnectionString(datasource *models.DataSource) (string, error) {
	tlsConfigurationMethod := strings.TrimSpace(
		strings.ToLower(datasource.JsonData.Get("tlsConfigurationMethod").MustString("file-path")))
	tlsMode := strings.TrimSpace(strings.ToLower(datasource.JsonData.Get("sslmode").MustString("verify-full")))
	isTLSDisabled := tlsMode == "disable"

	var host string
	var port int
	var err error
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

	connStr := fmt.Sprintf("user='%s' password='%s' host='%s' dbname='%s' sslmode='%s'",
		escape(datasource.User), escape(datasource.DecryptedPassword()), escape(host), escape(datasource.Database),
		escape(tlsMode))
	if port > 0 {
		connStr += fmt.Sprintf(" port=%d", port)
	}
	if isTLSDisabled {
		s.logger.Debug("Postgres TLS/SSL is disabled")
	} else {
		s.logger.Debug("Postgres TLS/SSL is enabled", "tlsMode", tlsMode)

		var tlsRootCert, tlsCert, tlsKey string
		if tlsConfigurationMethod == "file-content" {
			if tlsRootCert, tlsCert, tlsKey, err = s.writeCertFiles(datasource); err != nil {
				return "", err
			}
		} else {
			tlsRootCert = datasource.JsonData.Get("sslRootCertFile").MustString("")
			tlsCert = datasource.JsonData.Get("sslCertFile").MustString("")
			tlsKey = datasource.JsonData.Get("sslKeyFile").MustString("")
			if err = validateCertFunc(tlsRootCert, tlsCert, tlsKey); err != nil {
				return "", err
			}
		}

		// Attach root certificate if provided
		if tlsRootCert != "" {
			s.logger.Debug("Setting server root certificate", "tlsRootCert", tlsRootCert)
			connStr += fmt.Sprintf(" sslrootcert='%s'", escape(tlsRootCert))
		}

		// Attach client certificate and key if both are provided
		if tlsCert != "" && tlsKey != "" {
			s.logger.Debug("Setting TLS/SSL client auth", "tlsCert", tlsCert, "tlsKey", tlsKey)
			connStr += fmt.Sprintf(" sslcert='%s' sslkey='%s'", escape(tlsCert), escape(tlsKey))
		} else if tlsCert != "" || tlsKey != "" {
			return "", fmt.Errorf("TLS/SSL client certificate and key must both be specified")
		}
	}

	s.logger.Debug("Generated Postgres connection string successfully")
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
