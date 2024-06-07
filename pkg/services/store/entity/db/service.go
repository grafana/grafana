package db

import (
	"context"
	"database/sql"

	"xorm.io/xorm"

	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	DriverPostgres = "postgres"
	DriverMySQL    = "mysql"
	DriverSQLite   = "sqlite"
	DriverSQLite3  = "sqlite3"
)

// EntityDBInterface provides access to a database capable of supporting the
// Entity Server.
type EntityDBInterface interface {
	Init() error
	GetCfg() *setting.Cfg
	GetDB() (DB, error)

	// TODO: deprecate.
	GetSession() (*session.SessionDB, error)
	GetEngine() (*xorm.Engine, error)
}

// DB is a thin abstraction on *sql.DB to allow mocking to provide better unit
// testing. We purposefully hide database operation methods that would use
// context.Background().
type DB interface {
	ContextExecer
	BeginTx(context.Context, *sql.TxOptions) (Tx, error)
	WithTx(context.Context, *sql.TxOptions, TxFunc) error
	PingContext(context.Context) error
	Stats() sql.DBStats
	DriverName() string
}

// TxFunc is a function that executes with access to a transaction. The context
// it receives is the same context used to create the transaction, and is
// provided so that a general prupose TxFunc is able to retrieve information
// from that context, and derive other contexts that may be used to run database
// operation methods accepting a context. A derived context can be used to
// request a specific database operation to take no more than a specific
// fraction of the remaining timeout of the transaction context, or to enrich
// the downstream observability layer with relevant information regarding the
// specific operation being carried out.
type TxFunc = func(context.Context, Tx) error

// Tx is a thin abstraction on *sql.Tx to allow mocking to provide better unit
// testing. We allow database operation methods that do not take a
// context.Context here since a Tx can only be obtained with DB.BeginTx, which
// already takes a context.Context.
type Tx interface {
	ContextExecer
	Commit() error
	Rollback() error
}

// ContextExecer is a set of database operation methods that take
// context.Context.
type ContextExecer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}
