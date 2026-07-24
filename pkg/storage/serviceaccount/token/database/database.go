package database

import (
	"context"
	"database/sql"

	"github.com/jmoiron/sqlx"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/serviceaccount/token/contracts"
	"github.com/grafana/grafana/pkg/util/xorm"
)

type Database struct {
	dbType string
	sqlx   *sqlx.DB
	tracer trace.Tracer
	// Keep the engine alive because it owns the underlying sql.DB lifecycle.
	engine *xorm.Engine
}

func ProvideDatabase(db db.DB, tracer trace.Tracer) *Database {
	engine := db.GetEngine()
	return &Database{
		dbType: string(db.GetDBType()),
		sqlx:   sqlx.NewDb(engine.DB().DB, db.GetDialect().DriverName()),
		tracer: tracer,
		engine: engine,
	}
}

func (db *Database) DriverName() string {
	return db.dbType
}

func (db *Database) ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error) {
	spanCtx, span := db.tracer.Start(ctx, "ServiceAccountTokenDatabase.ExecContext")
	defer span.End()

	return db.sqlx.ExecContext(spanCtx, db.sqlx.Rebind(query), args...)
}

func (db *Database) QueryContext(ctx context.Context, query string, args ...any) (contracts.Rows, error) {
	spanCtx, span := db.tracer.Start(ctx, "ServiceAccountTokenDatabase.QueryContext")
	defer span.End()

	return db.sqlx.QueryContext(spanCtx, db.sqlx.Rebind(query), args...)
}
