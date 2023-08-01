package db

import (
	"context"
	"os"

	"xorm.io/core"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
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
	// WithNewDbSession behaves like [DB.WithDbSession] without picking up a transaction
	// from the context.
	WithNewDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
	// GetDialect returns an object that contains information about the peculiarities of
	// the particular database type available to the runtime.
	GetDialect() migrator.Dialect
	// GetDBType returns the name of the database type available to the runtime.
	GetDBType() core.DbType
	// GetSqlxSession is an experimental extension to use sqlx instead of xorm to
	// communicate with the database.
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

var InitTestDB = sqlstore.InitTestDB
var InitTestDBwithCfg = sqlstore.InitTestDBWithCfg
var ProvideService = sqlstore.ProvideService

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
