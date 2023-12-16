package dbconn

import (
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/grafana/grafana/pkg/infra/fs"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
	"xorm.io/xorm"
)

var tlslog = log.New("tls_mysql")

type Conn struct {
	log log.Logger

	dbCfg  databaseConfig
	engine *xorm.Engine
	tracer tracing.Tracer
}

func New(cfg *setting.Cfg, engine *xorm.Engine, tracer tracing.Tracer) (*Conn, error) {
	// This change will make xorm use an empty default schema for postgres and
	// by that mimic the functionality of how it was functioning before
	// xorm's changes above.
	xorm.DefaultPostgresSchema = ""
	conn := &Conn{
		log: log.New("sqlstore"),
	}
	err := conn.initEngine(cfg, engine)
	if err != nil {
		return nil, err
	}

	return conn, nil
}

func (ss *Conn) Engine() *xorm.Engine { return ss.engine }

func (ss *Conn) buildExtraConnectionString(sep rune) string {
	if ss.dbCfg.UrlQueryParams == nil {
		return ""
	}

	var sb strings.Builder
	for key, values := range ss.dbCfg.UrlQueryParams {
		for _, value := range values {
			sb.WriteRune(sep)
			sb.WriteString(key)
			sb.WriteRune('=')
			sb.WriteString(value)
		}
	}
	return sb.String()
}

func (ss *Conn) buildConnectionString(cfg *setting.Cfg) (string, error) {
	dbCfg, err := readConfig(cfg)
	if err != nil {
		return "", err
	}
	ss.dbCfg = dbCfg
	cnnstr := ss.dbCfg.ConnectionString

	// special case used by integration tests
	if cnnstr != "" {
		return cnnstr, nil
	}

	switch ss.dbCfg.Type {
	case migrator.MySQL:
		protocol := "tcp"
		if strings.HasPrefix(ss.dbCfg.Host, "/") {
			protocol = "unix"
		}

		cnnstr = fmt.Sprintf("%s:%s@%s(%s)/%s?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true",
			ss.dbCfg.User, ss.dbCfg.Pwd, protocol, ss.dbCfg.Host, ss.dbCfg.Name)

		if ss.dbCfg.SslMode == "true" || ss.dbCfg.SslMode == "skip-verify" {
			tlsCert, err := makeCert(ss.dbCfg)
			if err != nil {
				return "", err
			}
			if err := mysql.RegisterTLSConfig("custom", tlsCert); err != nil {
				return "", err
			}

			cnnstr += "&tls=custom"
		}

		if isolation := ss.dbCfg.IsolationLevel; isolation != "" {
			val := url.QueryEscape(fmt.Sprintf("'%s'", isolation))
			cnnstr += fmt.Sprintf("&transaction_isolation=%s", val)
		}

		// nolint:staticcheck
		if cfg.IsFeatureToggleEnabled(featuremgmt.FlagMysqlAnsiQuotes) {
			cnnstr += "&sql_mode='ANSI_QUOTES'"
		}

		cnnstr += ss.buildExtraConnectionString('&')
	case migrator.Postgres:
		addr, err := util.SplitHostPortDefault(ss.dbCfg.Host, "127.0.0.1", "5432")
		if err != nil {
			return "", fmt.Errorf("invalid host specifier '%s': %w", ss.dbCfg.Host, err)
		}

		args := []any{ss.dbCfg.User, addr.Host, addr.Port, ss.dbCfg.Name, ss.dbCfg.SslMode, ss.dbCfg.ClientCertPath,
			ss.dbCfg.ClientKeyPath, ss.dbCfg.CaCertPath}
		for i, arg := range args {
			if arg == "" {
				args[i] = "''"
			}
		}
		cnnstr = fmt.Sprintf("user=%s host=%s port=%s dbname=%s sslmode=%s sslcert=%s sslkey=%s sslrootcert=%s", args...)
		if ss.dbCfg.Pwd != "" {
			cnnstr += fmt.Sprintf(" password=%s", ss.dbCfg.Pwd)
		}

		cnnstr += ss.buildExtraConnectionString(' ')
	case migrator.SQLite:
		// special case for tests
		if !filepath.IsAbs(ss.dbCfg.Path) {
			ss.dbCfg.Path = filepath.Join(cfg.DataPath, ss.dbCfg.Path)
		}
		if err := os.MkdirAll(path.Dir(ss.dbCfg.Path), os.ModePerm); err != nil {
			return "", err
		}

		cnnstr = fmt.Sprintf("file:%s?cache=%s&mode=rwc", ss.dbCfg.Path, ss.dbCfg.CacheMode)

		if ss.dbCfg.WALEnabled {
			cnnstr += "&_journal_mode=WAL"
		}

		cnnstr += ss.buildExtraConnectionString('&')
	default:
		return "", fmt.Errorf("unknown database type: %s", ss.dbCfg.Type)
	}

	return cnnstr, nil
}

// initEngine initializes ss.engine.
func (ss *Conn) initEngine(cfg *setting.Cfg, engine *xorm.Engine) error {
	if ss.engine != nil {
		ss.log.Debug("Already connected to database")
		return nil
	}

	connectionString, err := ss.buildConnectionString(cfg)
	if err != nil {
		return err
	}

	if cfg.DatabaseInstrumentQueries {
		ss.dbCfg.Type = wrapDatabaseDriverWithHooks(ss.dbCfg.Type, ss.tracer)
	}

	ss.log.Info("Connecting to DB", "dbtype", ss.dbCfg.Type)
	if ss.dbCfg.Type == migrator.SQLite && strings.HasPrefix(connectionString, "file:") &&
		!strings.HasPrefix(connectionString, "file::memory:") {
		exists, err := fs.Exists(ss.dbCfg.Path)
		if err != nil {
			return fmt.Errorf("can't check for existence of %q: %w", ss.dbCfg.Path, err)
		}

		const perms = 0640
		if !exists {
			ss.log.Info("Creating SQLite database file", "path", ss.dbCfg.Path)
			f, err := os.OpenFile(ss.dbCfg.Path, os.O_CREATE|os.O_RDWR, perms)
			if err != nil {
				return fmt.Errorf("failed to create SQLite database file %q: %w", ss.dbCfg.Path, err)
			}
			if err := f.Close(); err != nil {
				return fmt.Errorf("failed to create SQLite database file %q: %w", ss.dbCfg.Path, err)
			}
		} else {
			fi, err := os.Lstat(ss.dbCfg.Path)
			if err != nil {
				return fmt.Errorf("failed to stat SQLite database file %q: %w", ss.dbCfg.Path, err)
			}
			m := fi.Mode() & os.ModePerm
			if m|perms != perms {
				ss.log.Warn("SQLite database file has broader permissions than it should",
					"path", ss.dbCfg.Path, "mode", m, "expected", os.FileMode(perms))
			}
		}
	}
	if engine == nil {
		var err error
		engine, err = xorm.NewEngine(ss.dbCfg.Type, connectionString)
		if err != nil {
			return err
		}
		// Only for MySQL or MariaDB, verify we can connect with the current connection string's system var for transaction isolation.
		// If not, create a new engine with a compatible connection string.
		if ss.dbCfg.Type == migrator.MySQL {
			engine, err = ss.ensureTransactionIsolationCompatibility(engine, connectionString)
			if err != nil {
				return err
			}
		}
	}

	engine.SetMaxOpenConns(ss.dbCfg.MaxOpenConn)
	engine.SetMaxIdleConns(ss.dbCfg.MaxIdleConn)
	engine.SetConnMaxLifetime(time.Second * time.Duration(ss.dbCfg.ConnMaxLifetime))

	// configure sql logging
	debugSQL := cfg.Raw.Section("database").Key("log_queries").MustBool(false)
	if !debugSQL {
		engine.SetLogger(&xorm.DiscardLogger{})
	} else {
		// add stack to database calls to be able to see what repository initiated queries. Top 7 items from the stack as they are likely in the xorm library.
		engine.SetLogger(newXormLogger(log.LvlInfo, log.WithSuffix(log.New("sqlstore.xorm"), log.CallerContextKey, log.StackCaller(log.DefaultCallerDepth))))
		engine.ShowSQL(true)
		engine.ShowExecTime(true)
	}

	ss.engine = engine
	return nil
}

// The transaction_isolation system variable isn't compatible with MySQL < 5.7.20 or MariaDB. If we get an error saying this
// system variable is unknown, then replace it with it's older version tx_isolation which is compatible with MySQL < 5.7.20 and MariaDB.
func (ss *Conn) ensureTransactionIsolationCompatibility(engine *xorm.Engine, connectionString string) (*xorm.Engine, error) {
	var result string
	_, err := engine.SQL("SELECT 1").Get(&result)

	var mysqlError *mysql.MySQLError
	if errors.As(err, &mysqlError) {
		// if there was an error due to transaction isolation
		if strings.Contains(mysqlError.Message, "Unknown system variable 'transaction_isolation'") {
			ss.log.Debug("transaction_isolation system var is unknown, overriding in connection string with tx_isolation instead")
			// replace with compatible system var for transaction isolation
			connectionString = strings.Replace(connectionString, "&transaction_isolation", "&tx_isolation", -1)
			// recreate the xorm engine with new connection string that is compatible
			engine, err = xorm.NewEngine(ss.dbCfg.Type, connectionString)
			if err != nil {
				return nil, err
			}
		}
	} else if err != nil {
		return nil, err
	}

	return engine, nil
}

// readConfig initializes the SQLStore from its configuration.
func readConfig(cfg *setting.Cfg) (databaseConfig, error) {
	dbCfg := databaseConfig{}
	sec := cfg.Raw.Section("database")

	cfgURL := sec.Key("url").String()
	if len(cfgURL) != 0 {
		dbURL, err := url.Parse(cfgURL)
		if err != nil {
			return dbCfg, err
		}
		dbCfg.Type = dbURL.Scheme
		dbCfg.Host = dbURL.Host

		pathSplit := strings.Split(dbURL.Path, "/")
		if len(pathSplit) > 1 {
			dbCfg.Name = pathSplit[1]
		}

		userInfo := dbURL.User
		if userInfo != nil {
			dbCfg.User = userInfo.Username()
			dbCfg.Pwd, _ = userInfo.Password()
		}

		dbCfg.UrlQueryParams = dbURL.Query()
	} else {
		dbCfg.Type = sec.Key("type").String()
		dbCfg.Host = sec.Key("host").String()
		dbCfg.Name = sec.Key("name").String()
		dbCfg.User = sec.Key("user").String()
		dbCfg.ConnectionString = sec.Key("connection_string").String()
		dbCfg.Pwd = sec.Key("password").String()
	}

	dbCfg.MaxOpenConn = sec.Key("max_open_conn").MustInt(0)
	dbCfg.MaxIdleConn = sec.Key("max_idle_conn").MustInt(2)
	dbCfg.ConnMaxLifetime = sec.Key("conn_max_lifetime").MustInt(14400)

	dbCfg.SslMode = sec.Key("ssl_mode").String()
	dbCfg.CaCertPath = sec.Key("ca_cert_path").String()
	dbCfg.ClientKeyPath = sec.Key("client_key_path").String()
	dbCfg.ClientCertPath = sec.Key("client_cert_path").String()
	dbCfg.ServerCertName = sec.Key("server_cert_name").String()
	dbCfg.Path = sec.Key("path").MustString("data/grafana.db")
	dbCfg.IsolationLevel = sec.Key("isolation_level").String()

	dbCfg.CacheMode = sec.Key("cache_mode").MustString("private")
	dbCfg.WALEnabled = sec.Key("wal").MustBool(false)
	dbCfg.SkipMigrations = sec.Key("skip_migrations").MustBool()
	dbCfg.MigrationLockAttemptTimeout = sec.Key("locking_attempt_timeout_sec").MustInt()

	dbCfg.QueryRetries = sec.Key("query_retries").MustInt()
	dbCfg.TransactionRetries = sec.Key("transaction_retries").MustInt(5)
	return dbCfg, nil
}

type databaseConfig struct {
	Type                        string
	Host                        string
	Name                        string
	User                        string
	Pwd                         string
	Path                        string
	SslMode                     string
	CaCertPath                  string
	ClientKeyPath               string
	ClientCertPath              string
	ServerCertName              string
	ConnectionString            string
	IsolationLevel              string
	MaxOpenConn                 int
	MaxIdleConn                 int
	ConnMaxLifetime             int
	CacheMode                   string
	WALEnabled                  bool
	UrlQueryParams              map[string][]string
	SkipMigrations              bool
	MigrationLockAttemptTimeout int
	// SQLite only
	QueryRetries int
	// SQLite only
	TransactionRetries int
}

func makeCert(config databaseConfig) (*tls.Config, error) {
	rootCertPool := x509.NewCertPool()
	pem, err := os.ReadFile(config.CaCertPath)
	if err != nil {
		return nil, fmt.Errorf("could not read DB CA Cert path %q: %w", config.CaCertPath, err)
	}
	if ok := rootCertPool.AppendCertsFromPEM(pem); !ok {
		return nil, err
	}

	tlsConfig := &tls.Config{
		RootCAs: rootCertPool,
	}
	if config.ClientCertPath != "" && config.ClientKeyPath != "" {
		tlsConfig.GetClientCertificate = func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
			tlslog.Debug("Loading client certificate")
			cert, err := tls.LoadX509KeyPair(config.ClientCertPath, config.ClientKeyPath)
			return &cert, err
		}
	}
	tlsConfig.ServerName = config.ServerCertName
	if config.SslMode == "skip-verify" {
		tlsConfig.InsecureSkipVerify = true
	}
	// Return more meaningful error before it is too late
	if config.ServerCertName == "" && !tlsConfig.InsecureSkipVerify {
		return nil, fmt.Errorf("server_cert_name is missing. Consider using ssl_mode = skip-verify")
	}
	return tlsConfig, nil
}
