package sqlstore

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/go-sql-driver/mysql"
	"gopkg.in/ini.v1"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type DatabaseConfig struct {
	Type                        string
	Host                        string
	Name                        string
	User                        string
	Pwd                         string
	Path                        string
	SslMode                     string
	SSLSNI                      string
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
	MigrationLock               bool
	MigrationLockAttemptTimeout int
	LogQueries                  bool
	// SQLite only
	QueryRetries int
	// SQLite only
	TransactionRetries int
}

func NewDatabaseConfig(cfg *setting.Cfg, features featuremgmt.FeatureToggles) (*DatabaseConfig, error) {
	if cfg == nil {
		return nil, errors.New("cfg cannot be nil")
	}

	dbCfg := &DatabaseConfig{}
	if err := dbCfg.readConfig(cfg); err != nil {
		return nil, err
	}

	if err := dbCfg.buildConnectionString(cfg, features); err != nil {
		return nil, err
	}

	return dbCfg, nil
}

// readConfigSection reads the database configuration from the given block of
// the configuration file. This method allows us to add a "database_replica"
// section to the configuration file while using the same cfg struct.
func (dbCfg *DatabaseConfig) readConfigSection(cfg *setting.Cfg, section string) error {
	sec := cfg.Raw.Section(section)
	return dbCfg.parseConfigIni(sec)
}

func (dbCfg *DatabaseConfig) parseConfigIni(sec *ini.Section) error {
	cfgURL := sec.Key("url").String()
	if len(cfgURL) != 0 {
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
	dbCfg.SSLSNI = sec.Key("ssl_sni").String()
	dbCfg.CaCertPath = sec.Key("ca_cert_path").String()
	dbCfg.ClientKeyPath = sec.Key("client_key_path").String()
	dbCfg.ClientCertPath = sec.Key("client_cert_path").String()
	dbCfg.ServerCertName = sec.Key("server_cert_name").String()
	dbCfg.Path = sec.Key("path").MustString("data/grafana.db")
	dbCfg.IsolationLevel = sec.Key("isolation_level").String()
	dbCfg.CacheMode = sec.Key("cache_mode").MustString("private")
	dbCfg.WALEnabled = sec.Key("wal").MustBool(false)
	dbCfg.SkipMigrations = sec.Key("skip_migrations").MustBool()
	dbCfg.MigrationLock = sec.Key("migration_locking").MustBool(true)
	dbCfg.MigrationLockAttemptTimeout = sec.Key("locking_attempt_timeout_sec").MustInt()
	dbCfg.QueryRetries = sec.Key("query_retries").MustInt()
	dbCfg.TransactionRetries = sec.Key("transaction_retries").MustInt(5)
	dbCfg.LogQueries = sec.Key("log_queries").MustBool(false)
	return nil
}

// readConfig is a wrapper around readConfigSection that read the "database" configuration block.
func (dbCfg *DatabaseConfig) readConfig(cfg *setting.Cfg) error {
	return dbCfg.readConfigSection(cfg, "database")
}

func (dbCfg *DatabaseConfig) buildConnectionString(cfg *setting.Cfg, features featuremgmt.FeatureToggles) error {
	if dbCfg.ConnectionString != "" {
		return nil
	}

	cnnstr := ""

	switch dbCfg.Type {
	case migrator.MySQL:
		protocol := "tcp"
		if strings.HasPrefix(dbCfg.Host, "/") {
			protocol = "unix"
		}

		cnnstr = fmt.Sprintf("%s:%s@%s(%s)/%s?collation=utf8mb4_unicode_ci&allowNativePasswords=true&clientFoundRows=true",
			dbCfg.User, dbCfg.Pwd, protocol, dbCfg.Host, dbCfg.Name)

		if dbCfg.SslMode == "true" || dbCfg.SslMode == "skip-verify" {
			tlsCert, err := makeCert(dbCfg)
			if err != nil {
				return err
			}
			if err := mysql.RegisterTLSConfig("custom", tlsCert); err != nil {
				return err
			}

			cnnstr += "&tls=custom"
		}

		if isolation := dbCfg.IsolationLevel; isolation != "" {
			val := url.QueryEscape(fmt.Sprintf("'%s'", isolation))
			cnnstr += fmt.Sprintf("&transaction_isolation=%s", val)
		}

		if features != nil && features.IsEnabledGlobally(featuremgmt.FlagMysqlAnsiQuotes) {
			cnnstr += "&sql_mode='ANSI_QUOTES'"
		}

		cnnstr += buildExtraConnectionString('&', dbCfg.UrlQueryParams)
	case migrator.Postgres:
		addr, err := util.SplitHostPortDefault(dbCfg.Host, "127.0.0.1", "5432")
		if err != nil {
			return fmt.Errorf("invalid host specifier '%s': %w", dbCfg.Host, err)
		}

		args := []any{dbCfg.User, addr.Host, addr.Port, dbCfg.Name, dbCfg.SslMode, dbCfg.ClientCertPath,
			dbCfg.ClientKeyPath, dbCfg.CaCertPath}

		for i, arg := range args {
			if arg == "" {
				args[i] = "''"
			}
		}
		cnnstr = fmt.Sprintf("user=%s host=%s port=%s dbname=%s sslmode=%s sslcert=%s sslkey=%s sslrootcert=%s", args...)
		if dbCfg.SSLSNI != "" {
			cnnstr += fmt.Sprintf(" sslsni=%s", dbCfg.SSLSNI)
		}
		if dbCfg.Pwd != "" {
			cnnstr += fmt.Sprintf(" password=%s", dbCfg.Pwd)
		}

		cnnstr += buildExtraConnectionString(' ', dbCfg.UrlQueryParams)
	case migrator.SQLite:
		// special case for tests
		if !filepath.IsAbs(dbCfg.Path) {
			dbCfg.Path = filepath.Join(cfg.DataPath, dbCfg.Path)
		}
		if err := os.MkdirAll(path.Dir(dbCfg.Path), 0o750); err != nil {
			return err
		}

		cnnstr = fmt.Sprintf("file:%s?cache=%s&mode=rwc", dbCfg.Path, dbCfg.CacheMode)

		if dbCfg.WALEnabled {
			cnnstr += "&_journal_mode=WAL"
		}

		cnnstr += buildExtraConnectionString('&', dbCfg.UrlQueryParams)
	default:
		return fmt.Errorf("unknown database type: %s", dbCfg.Type)
	}

	dbCfg.ConnectionString = cnnstr

	return nil
}

func buildExtraConnectionString(sep rune, urlQueryParams map[string][]string) string {
	if urlQueryParams == nil {
		return ""
	}

	var sb strings.Builder
	for key, values := range urlQueryParams {
		for _, value := range values {
			sb.WriteRune(sep)
			sb.WriteString(key)
			sb.WriteRune('=')
			sb.WriteString(value)
		}
	}
	return sb.String()
}

func validateReplicaConfigs(primary *DatabaseConfig, cfgs []DatabaseConfig) error {
	if cfgs == nil {
		return errors.New("cfg cannot be nil")
	}

	// Return multiple errors so we can fix them all at once!
	var result error

	// Check for duplicate connection strings
	seen := make(map[string]struct{})
	seen[primary.ConnectionString] = struct{}{}
	for _, cfg := range cfgs {
		if _, ok := seen[cfg.ConnectionString]; ok {
			result = errors.Join(result, errors.New("duplicate connection string"))
		} else {
			seen[cfg.ConnectionString] = struct{}{}
		}
	}

	// Verify that every database is the same type and version, and that it matches the primary database.
	// The database Yype may include a "withHooks" suffix, which is used to differentiate drivers for instrumentation and ignored for the purpose of this check.
	for _, cfg := range cfgs {
		if databaseDriverFromName(cfg.Type) != databaseDriverFromName(primary.Type) {
			result = errors.Join(result, fmt.Errorf("the replicas must have the same database type as the primary database (%s != %s)", primary.Type, cfg.Type))
			break // Only need to report this once
		}
	}

	return result
}

// databaseDriverFromName strips any suffixes from the driver type that are not relevant to the database driver.
// This is used to remove the "WithHooks" or "ReplWithHooks" suffixes which are used to differentiate drivers for instrumentation.
func databaseDriverFromName(driverTy string) string {
	if strings.HasPrefix(driverTy, migrator.MySQL) {
		return migrator.MySQL
	}
	if strings.HasPrefix(driverTy, migrator.Postgres) {
		return migrator.Postgres
	}
	if strings.HasPrefix(driverTy, migrator.SQLite) {
		return migrator.SQLite
	}
	// default
	return driverTy
}
