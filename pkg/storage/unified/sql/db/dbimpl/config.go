package dbimpl

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/go-sql-driver/mysql"

	"github.com/grafana/grafana/pkg/setting"
)

type DatabaseConfig struct {
	Type             string
	Host             string
	Name             string
	User             string
	Pwd              string
	Path             string
	SslMode          string
	SSLSNI           string
	CaCertPath       string
	ClientKeyPath    string
	ClientCertPath   string
	ServerCertName   string
	ConnectionString string
	IsolationLevel   string
	MaxOpenConn      int
	MaxIdleConn      int
	ConnMaxLifetime  int
	CacheMode        string
	WALEnabled       bool
	UrlQueryParams   map[string][]string
}

func NewDatabaseConfig(cfg *setting.Cfg) (*DatabaseConfig, error) {
	if cfg == nil {
		return nil, fmt.Errorf("cfg cannot be nil")
	}

	dbCfg := &DatabaseConfig{}
	if err := dbCfg.readConfig(cfg); err != nil {
		return nil, err
	}
	if err := dbCfg.buildConnectionString(cfg); err != nil {
		return nil, err
	}
	return dbCfg, nil
}

func (dbCfg *DatabaseConfig) readConfig(cfg *setting.Cfg) error {
	sec := cfg.Raw.Section("database")

	cfgURL := sec.Key("url").String()
	if cfgURL != "" {
		dbURL, err := url.Parse(cfgURL)
		if err != nil {
			return err
		}
		dbCfg.Type = dbURL.Scheme
		dbCfg.Host = dbURL.Host

		pathSplit := strings.Split(dbURL.Path, "/")
		if len(pathSplit) > 1 {
			dbCfg.Name = pathSplit[1]
		}

		if userInfo := dbURL.User; userInfo != nil {
			dbCfg.User = userInfo.Username()
			dbCfg.Pwd, _ = userInfo.Password()
		}
		dbCfg.UrlQueryParams = dbURL.Query()
	} else {
		dbCfg.Type = sec.Key("type").String()
		dbCfg.Host = sec.Key("host").String()
		if port := sec.Key("port").String(); port != "" {
			dbCfg.Host += ":" + port
		}
		dbCfg.Name = sec.Key("name").String()
		dbCfg.User = sec.Key("user").String()
		dbCfg.ConnectionString = sec.Key("connection_string").String()
		dbCfg.Pwd = sec.Key("password").String()
	}

	dbCfg.MaxOpenConn = sec.Key("max_open_conn").MustInt(0)
	dbCfg.MaxIdleConn = sec.Key("max_idle_conn").MustInt(2)
	dbCfg.ConnMaxLifetime = sec.Key("conn_max_lifetime").MustInt(14400)

	dbCfg.SslMode = sec.Key("ssl_mode").String()
	dbCfg.SSLSNI = sec.Key("ssl_sni").String()
	dbCfg.CaCertPath = sec.Key("ca_cert_path").String()
	dbCfg.ClientKeyPath = sec.Key("client_key_path").String()
	dbCfg.ClientCertPath = sec.Key("client_cert_path").String()
	dbCfg.ServerCertName = sec.Key("server_cert_name").String()
	dbCfg.Path = sec.Key("path").MustString("data/grafana.db")
	dbCfg.IsolationLevel = sec.Key("isolation_level").String()

	dbCfg.CacheMode = sec.Key("cache_mode").MustString("private")
	dbCfg.WALEnabled = sec.Key("wal").MustBool(false)
	return nil
}

func (dbCfg *DatabaseConfig) buildConnectionString(cfg *setting.Cfg) error {
	if dbCfg.ConnectionString != "" {
		return nil
	}

	switch dbCfg.Type {
	case dbTypeMySQL:
		protocol := "tcp"
		if strings.HasPrefix(dbCfg.Host, "/") {
			protocol = "unix"
		}

		cnnstr := fmt.Sprintf("%s:%s@%s(%s)/%s?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true&parseTime=true",
			dbCfg.User, dbCfg.Pwd, protocol, dbCfg.Host, dbCfg.Name)

		if dbCfg.SslMode == "true" || dbCfg.SslMode == "skip-verify" {
			tlsCert, err := makeMySQLTLSConfig(dbCfg)
			if err != nil {
				return err
			}
			name := "resource_api_custom"
			if err := mysql.RegisterTLSConfig(name, tlsCert); err != nil && !strings.Contains(err.Error(), "already registered") {
				return err
			}
			cnnstr += "&tls=" + name
		}

		if isolation := dbCfg.IsolationLevel; isolation != "" {
			val := url.QueryEscape(fmt.Sprintf("'%s'", isolation))
			cnnstr += fmt.Sprintf("&transaction_isolation=%s", val)
		}

		cnnstr += "&sql_mode=ANSI_QUOTES"
		cnnstr += buildExtraConnectionString('&', dbCfg.UrlQueryParams)
		dbCfg.ConnectionString = cnnstr
		return nil

	case dbTypePostgres:
		host, port, err := splitHostPortDefault(dbCfg.Host, "127.0.0.1", "5432")
		if err != nil {
			return fmt.Errorf("invalid host specifier %q: %w", dbCfg.Host, err)
		}

		args := []any{dbCfg.User, host, port, dbCfg.Name, dbCfg.SslMode, dbCfg.ClientCertPath, dbCfg.ClientKeyPath, dbCfg.CaCertPath}
		for i, arg := range args {
			if arg == "" {
				args[i] = "''"
			}
		}
		cnnstr := fmt.Sprintf("user=%s host=%s port=%s dbname=%s sslmode=%s sslcert=%s sslkey=%s sslrootcert=%s", args...)
		if dbCfg.SSLSNI != "" {
			cnnstr += fmt.Sprintf(" sslsni=%s", dbCfg.SSLSNI)
		}
		if dbCfg.Pwd != "" {
			cnnstr += fmt.Sprintf(" password=%s", dbCfg.Pwd)
		}
		cnnstr += buildExtraConnectionString(' ', dbCfg.UrlQueryParams)
		dbCfg.ConnectionString = cnnstr
		return nil

	case dbTypeSQLite:
		if !filepath.IsAbs(dbCfg.Path) {
			dbCfg.Path = filepath.Join(cfg.DataPath, dbCfg.Path)
		}
		if err := os.MkdirAll(path.Dir(dbCfg.Path), 0o750); err != nil {
			return err
		}

		cnnstr := fmt.Sprintf("file:%s?cache=%s&mode=rwc", dbCfg.Path, dbCfg.CacheMode)
		if dbCfg.WALEnabled {
			cnnstr += "&_journal_mode=WAL"
		}
		cnnstr += buildExtraConnectionString('&', dbCfg.UrlQueryParams)
		dbCfg.ConnectionString = cnnstr
		return nil
	default:
		return fmt.Errorf("unknown database type: %s", dbCfg.Type)
	}
}

func buildExtraConnectionString(sep rune, params map[string][]string) string {
	if params == nil {
		return ""
	}

	var b strings.Builder
	for key, values := range params {
		for _, value := range values {
			b.WriteRune(sep)
			b.WriteString(key)
			b.WriteRune('=')
			b.WriteString(value)
		}
	}
	return b.String()
}

func makeMySQLTLSConfig(config *DatabaseConfig) (*tls.Config, error) {
	rootCertPool := x509.NewCertPool()
	pem, err := os.ReadFile(config.CaCertPath)
	if err != nil {
		return nil, fmt.Errorf("could not read DB CA cert path %q: %w", config.CaCertPath, err)
	}
	if ok := rootCertPool.AppendCertsFromPEM(pem); !ok {
		return nil, fmt.Errorf("failed to append DB CA certs")
	}

	tlsConfig := &tls.Config{
		RootCAs: rootCertPool,
	}
	if config.ClientCertPath != "" && config.ClientKeyPath != "" {
		tlsConfig.GetClientCertificate = func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
			cert, err := tls.LoadX509KeyPair(config.ClientCertPath, config.ClientKeyPath)
			return &cert, err
		}
	}
	tlsConfig.ServerName = config.ServerCertName
	if config.SslMode == "skip-verify" {
		tlsConfig.InsecureSkipVerify = true
	}
	if config.ServerCertName == "" && !tlsConfig.InsecureSkipVerify {
		return nil, fmt.Errorf("server_cert_name is missing. Consider using ssl_mode = skip-verify")
	}
	return tlsConfig, nil
}
