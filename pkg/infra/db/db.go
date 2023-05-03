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
	WithTransactionalDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
	WithDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
	WithNewDbSession(ctx context.Context, callback sqlstore.DBTransactionFunc) error
	GetDialect() migrator.Dialect
	GetDBType() core.DbType
	GetSqlxSession() *session.SessionDB
	InTransaction(ctx context.Context, fn func(ctx context.Context) error) error
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
