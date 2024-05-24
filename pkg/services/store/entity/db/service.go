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

type TxFunc = func(context.Context, Tx) error

type Tx interface {
	ContextExecer
	Exec(query string, args ...any) (sql.Result, error)
	Query(query string, args ...any) (*sql.Rows, error)
	QueryRow(query string, args ...any) *sql.Row
	Commit() error
	Rollback() error
}

type ContextExecer interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}
