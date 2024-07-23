package dbimpl

import (
	"cmp"
	"fmt"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
	"go.opentelemetry.io/otel/trace"
	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/store/entity/db"
)

func getEngineMySQL(getter *sectionGetter, _ trace.Tracer) (*xorm.Engine, error) {
	config := mysql.NewConfig()
	config.User = getter.String("db_user")
	config.Passwd = getter.String("db_pass")
	config.Net = "tcp"
	config.Addr = getter.String("db_host")
	config.DBName = getter.String("db_name")
	config.Params = map[string]string{
		// See: https://dev.mysql.com/doc/refman/en/sql-mode.html
		"@@SESSION.sql_mode": "ANSI",
	}
	config.Collation = "utf8mb4_unicode_ci"
	config.Loc = time.UTC
	config.AllowNativePasswords = true
	config.ClientFoundRows = true

	// allow executing multiple SQL statements in a single roundtrip, and also
	// enable executing the CALL statement to run stored procedures that execute
	// multiple SQL statements.
	//config.MultiStatements = true

	// TODO: do we want to support these?
	//	config.ServerPubKey = getter.String("db_server_pub_key")
	//	config.TLSConfig = getter.String("db_tls_config_name")

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

func getEnginePostgres(getter *sectionGetter, _ trace.Tracer) (*xorm.Engine, error) {
	dsnKV := map[string]string{
		"user":     getter.String("db_user"),
		"password": getter.String("db_pass"),
		"dbname":   getter.String("db_name"),
		"sslmode":  cmp.Or(getter.String("db_sslmode"), "disable"),
	}

	// TODO: probably interesting:
	//	"passfile", "statement_timeout", "lock_timeout", "connect_timeout"

	// TODO: for CockroachDB, we probably need to use the following:
	//	dsnKV["options"] = "-c enable_experimental_alter_column_type_general=true"
	// Or otherwise specify it as:
	//	dsnKV["enable_experimental_alter_column_type_general"] = "true"

	// TODO: do we want to support these options in the DSN as well?
	//	"sslkey", "sslcert", "sslrootcert", "sslpassword", "sslsni", "krbspn",
	//	"krbsrvname", "target_session_attrs", "service", "servicefile"

	// More on Postgres connection string parameters:
	//	https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING

	hostport := getter.String("db_host")

	if err := getter.Err(); err != nil {
		return nil, fmt.Errorf("config error: %w", err)
	}

	host, port, err := splitHostPortDefault(hostport, "127.0.0.1", "5432")
	if err != nil {
		return nil, fmt.Errorf("invalid db_host: %w", err)
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
