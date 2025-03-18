package dbimpl

import (
	"cmp"
	"fmt"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

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
	sslMode := getter.String("ssl_mode")
	if sslMode == "true" || sslMode == "skip-verify" {
		config.Params["tls"] = "preferred"
	}
	tls := getter.String("tls")
	if tls != "" {
		config.Params["tls"] = tls
	}
	config.Collation = "utf8mb4_unicode_ci"
	config.Loc = time.UTC
	config.AllowNativePasswords = true
	config.ClientFoundRows = true
	config.ParseTime = true

	// allow executing multiple SQL statements in a single roundtrip, and also
	// enable executing the CALL statement to run stored procedures that execute
	// multiple SQL statements.
	//config.MultiStatements = true

	// TODO: do we want to support these?
	//	config.ServerPubKey = getter.String("server_pub_key")
	//	config.TLSConfig = getter.String("tls_config_name")

	if err := getter.Err(); err != nil {
		return nil, fmt.Errorf("config error: %w", err)
	}

	if strings.HasPrefix(config.Addr, "/") {
		config.Net = "unix"
	}

	// FIXME: get rid of xorm
	engine, err := xorm.NewEngine(db.DriverMySQL, config.FormatDSN())
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	engine.SetMaxOpenConns(0)
	engine.SetMaxIdleConns(2)
	engine.SetConnMaxLifetime(4 * time.Hour)

	return engine, nil
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
