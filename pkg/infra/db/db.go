package db

import (
	"context"
	"os"

	"github.com/grafana/grafana/pkg/util/xorm/core"

	"github.com/grafana/grafana/pkg/util/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/services/sqlstore/sqlutil"
	"github.com/grafana/grafana/pkg/setting"
)

type DB interface {
	// WithTransactionalDbSession creates a new SQL transaction to ensure consistency
	// for the database operations done within the [sqlstore.DBTransactionFunc].
	// It's better to combine InTransaction and WithDbSession instead, as the context
	// variable is not updated when using this method.
	WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
	// WithDbSession runs database operations either in an existing transaction available
	// through [context.Context] or if that's not present, as non-transactional database
	// operations.
	WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
	// GetDialect returns an object that contains information about the peculiarities of
	// the particular database type available to the runtime.
	GetDialect() migrator.Dialect
	// GetDBType returns the name of the database type available to the runtime.
	GetDBType() core.DbType
	// GetEngine returns the underlying xorm engine.
	GetEngine() *xorm.Engine
	// GetSqlxSession is an experimental extension to use sqlx instead of xorm to
	// communicate with the database.
	// NOTE: when using this session with mysql, the connection will *not* have:
	// the expected parameters: "&sql_mode='ANSI_QUOTES" and "&parseTime=true"
	// The sqlx session is useful, but be careful not to expect automagic date parsing
	GetSqlxSession() *session.SessionDB
	// InTransaction creates a new SQL transaction that is placed on the context.
	// Use together with [DB.WithDbSession] to run database operations.
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
	// Quote wraps an identifier so that it cannot be mistaken for an SQL keyword.
	Quote(value string) string
	// RecursiveQueriesAreSupported runs a dummy recursive query and it returns true
	// if the query runs successfully or false if it fails with mysqlerr.ER_PARSE_ERROR error or any other error
	RecursiveQueriesAreSupported() (bool, error)
}

type Session = sqlstore.DBSession
type InitTestDBOpt = sqlstore.InitTestDBOpt

// Re-exported so NewTestStore callers need not import sqlstore directly;
// TestingTB mirrors the standard library's testing.TB (see sqlstore.TestingTB).
type TestingTB = sqlstore.TestingTB
type TestOption = sqlstore.TestOption

var SetupTestDB = sqlstore.SetupTestDB
var CleanupTestDB = sqlstore.CleanupTestDB
var ProvideService = sqlstore.ProvideService

// Options for NewTestStore, re-exported from sqlstore.
var (
	WithFeatureFlags         = sqlstore.WithFeatureFlags
	WithoutFeatureFlags      = sqlstore.WithoutFeatureFlags
	WithFeatureFlag          = sqlstore.WithFeatureFlag
	WithOSSMigrations        = sqlstore.WithOSSMigrations
	WithMigrator             = sqlstore.WithMigrator
	WithoutMigrator          = sqlstore.WithoutMigrator
	WithTracer               = sqlstore.WithTracer
	WithoutDefaultOrgAndUser = sqlstore.WithoutDefaultOrgAndUser
	WithCfg                  = sqlstore.WithCfg
	WithTruncation           = sqlstore.WithTruncation
)

// NewTestStore creates a SQLStore with an isolated, temporary database for
// this test. Unlike InitTestDB there is no shared database or truncation
// between tests, so tests using it may run in parallel. See
// sqlstore.NewTestStore for details and options.
func NewTestStore(tb TestingTB, opts ...TestOption) *sqlstore.SQLStore {
	tb.Helper()
	return sqlstore.NewTestStore(tb, opts...)
}

// Deprecated: use NewTestStore instead. It gives each test an isolated,
// temporary database instead of sharing one database with truncation between
// tests. New calls to InitTestDB fail lint (staticcheck SA1019).
func InitTestDB(t sqlutil.ITestDB, opts ...InitTestDBOpt) *sqlstore.SQLStore {
	db, _ := InitTestDBWithCfg(t, opts...) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	return db
}

// Deprecated: use NewTestStore instead, with sqlstore.WithCfg to supply a
// config. See InitTestDB.
func InitTestDBWithCfg(t sqlutil.ITestDB, opts ...InitTestDBOpt) (*sqlstore.SQLStore, *setting.Cfg) {
	return sqlstore.InitTestDB(t, opts...) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
}

func IsTestDbSQLite() bool {
	if db, present := os.LookupEnv("GRAFANA_TEST_DB"); !present || db == "sqlite" {
		return true
	}

	return !IsTestDbMySQL() && !IsTestDbPostgres()
}

func IsTestDbMySQL() bool {
	if db, present := os.LookupEnv("GRAFANA_TEST_DB"); present {
		return db == migrator.MySQL
	}

	return false
}

func IsTestDbPostgres() bool {
	if db, present := os.LookupEnv("GRAFANA_TEST_DB"); present {
		return db == migrator.Postgres
	}

	return false
}

func IsTestDBMSSQL() bool {
	if db, present := os.LookupEnv("GRAFANA_TEST_DB"); present {
		return db == migrator.MSSQL
	}

	return false
}
