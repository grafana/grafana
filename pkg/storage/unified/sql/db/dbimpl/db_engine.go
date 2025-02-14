package dbimpl

import (
	"cmp"
	"fmt"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/grafana/dskit/crypto/tls"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

// tlsConfigName is the name of the TLS config that we register with the MySQL
// driver.
const tlsConfigName = "db_engine_tls"

func getEngineMySQL(getter confGetter) (*xorm.Engine, error) {
	config := mysql.NewConfig()
	config.User = getter.String("user")
	// accept the core Grafana jargon of `password` as well, originally Unified
	// Storage used `pass`
	config.Passwd = cmp.Or(getter.String("pass"), getter.String("password"))
	config.Net = "tcp"
	config.Addr = getter.String("host")
	config.DBName = getter.String("name")
	config.Params = map[string]string{
		// See: https://dev.mysql.com/doc/refman/en/sql-mode.html
		"@@SESSION.sql_mode": "ANSI",
	}
	config.Collation = "utf8mb4_unicode_ci"
	config.Loc = time.UTC
	config.AllowNativePasswords = true
	config.ClientFoundRows = true
	config.ParseTime = true

	// Setup TLS for the database connection if configured.
	if err := configureTLS(getter, config); err != nil {
		return nil, fmt.Errorf("failed to configure TLS: %w", err)
	}

	// allow executing multiple SQL statements in a single roundtrip, and also
	// enable executing the CALL statement to run stored procedures that execute
	// multiple SQL statements.
	//config.MultiStatements = true

	if err := getter.Err(); err != nil {
		return nil, fmt.Errorf("config error: %w", err)
	}

	if strings.HasPrefix(config.Addr, "/") {
		config.Net = "unix"
	}

	engine, err := xorm.NewEngine(db.DriverMySQL, config.FormatDSN())
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	engine.SetMaxOpenConns(0)
	engine.SetMaxIdleConns(2)
	engine.SetConnMaxLifetime(4 * time.Hour)

	return engine, nil
}

func configureTLS(getter confGetter, config *mysql.Config) error {
	sslMode := getter.String("ssl_mode")

	if sslMode == "true" || sslMode == "skip-verify" {
		tlsCfg := tls.ClientConfig{
			CAPath:     getter.String("ca_cert_path"),
			CertPath:   getter.String("client_cert_path"),
			KeyPath:    getter.String("client_key_path"),
			ServerName: getter.String("server_cert_name"),
		}

		rawTLSCfg, err := tlsCfg.GetTLSConfig()
		if err != nil {
			return fmt.Errorf("failed to get TLS config for mysql: %w", err)
		}

		if sslMode == "skip-verify" {
			rawTLSCfg.InsecureSkipVerify = true
		}

		if err := mysql.RegisterTLSConfig(tlsConfigName, rawTLSCfg); err != nil {
			return fmt.Errorf("failed to register TLS config for mysql: %w", err)
		}

		config.TLSConfig = tlsConfigName
	}

	// If the TLS mode is set in the database config, we need to set it here.
	if tls := getter.String("tls"); tls != "" {
		// If the user has provided TLS certs, we don't want to use the tls=<value>, as
		// they would override the TLS config that we set above. They both use the same
		// parameter, so we need to check for that.
		if sslMode == "true" {
			return fmt.Errorf("cannot provide tls certs and tls=<value> at the same time")
		}
		config.Params["tls"] = tls
	}

	return nil
}

func getEnginePostgres(getter confGetter) (*xorm.Engine, error) {
	dsnKV := map[string]string{
		"user": getter.String("user"),
		// accept the core Grafana jargon of `password` as well, originally
		// Unified Storage used `pass`
		"password":    cmp.Or(getter.String("pass"), getter.String("password")),
		"dbname":      getter.String("name"),
		"sslmode":     cmp.Or(getter.String("ssl_mode"), "disable"),
		"sslsni":      getter.String("ssl_sni"),
		"sslrootcert": getter.String("ca_cert_path"),
		"sslkey":      getter.String("client_key_path"),
		"sslcert":     getter.String("client_cert_path"),
	}

	// TODO: probably interesting:
	//	"passfile", "statement_timeout", "lock_timeout", "connect_timeout"

	// TODO: for CockroachDB, we probably need to use the following:
	//	dsnKV["options"] = "-c enable_experimental_alter_column_type_general=true"
	// Or otherwise specify it as:
	//	dsnKV["enable_experimental_alter_column_type_general"] = "true"

	// TODO: do we want to support these options in the DSN as well?
	//	"sslpassword", "krbspn", "krbsrvname", "target_session_attrs", "service", "servicefile"

	// More on Postgres connection string parameters:
	//	https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING

	hostport := getter.String("host")

	if err := getter.Err(); err != nil {
		return nil, fmt.Errorf("config error: %w", err)
	}

	host, port, err := splitHostPortDefault(hostport, "127.0.0.1", "5432")
	if err != nil {
		return nil, fmt.Errorf("invalid host: %w", err)
	}
	dsnKV["host"] = host
	dsnKV["port"] = port

	dsn, err := MakeDSN(dsnKV)
	if err != nil {
		return nil, fmt.Errorf("error building DSN: %w", err)
	}

	// FIXME: get rid of xorm
	engine, err := xorm.NewEngine(db.DriverPostgres, dsn)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	return engine, nil
}
