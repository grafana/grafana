package legacysql

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/lib/pq"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/sqlutil"
	storagemigrator "github.com/grafana/grafana/pkg/storage/sqlutil/migrator"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/util/sqlite"
)

type sqlSessionProvider = sqlutil.SessionProvider

// The database may depend on the request context
type LegacyDatabaseProvider func(ctx context.Context) (*LegacyDatabaseHelper, error)

// NewDatabaseProvider returns a simple provider that always uses the same database implementation
func NewDatabaseProvider(db sqlSessionProvider) LegacyDatabaseProvider {
	helper := &LegacyDatabaseHelper{
		DB: db,
		Table: func(n string) string {
			return n
		},
	}
	return func(ctx context.Context) (*LegacyDatabaseHelper, error) {
		return helper, nil
	}
}

type LegacyDatabaseHelper struct {
	// The database connection
	DB sqlSessionProvider

	// table name locator
	Table func(n string) string
}

type ConstraintDialect interface {
	IsUniqueConstraintViolation(error) bool
	ErrorMessage(error) string
}

// Helper to pick the correct dialect
func (h *LegacyDatabaseHelper) DialectForDriver() sqltemplate.Dialect {
	if h.DB == nil {
		return nil
	}
	return sqltemplate.DialectForDriver(h.Session().DriverName())
}

func (h *LegacyDatabaseHelper) Session() *session.SessionDB {
	if h.DB == nil {
		return nil
	}
	return h.DB.GetSqlxSession()
}

func (h *LegacyDatabaseHelper) GetDialect() ConstraintDialect {
	switch h.Session().DriverName() {
	case storagemigrator.MySQL:
		return mysqlConstraintDialect{}
	case storagemigrator.Postgres:
		return postgresConstraintDialect{}
	case storagemigrator.SQLite:
		return sqliteConstraintDialect{}
	default:
		return genericConstraintDialect{}
	}
}

func (h *LegacyDatabaseHelper) TableExists(ctx context.Context, table string) (bool, error) {
	if h.DB == nil {
		return false, nil
	}
	return sqlutil.TableExists(ctx, h.Session().SqlDB(), storagemigrator.NewDialect(h.Session().DriverName()), h.Table(table))
}

func (h *LegacyDatabaseHelper) QuoteIdentifier(value string) (string, error) {
	dialect := h.DialectForDriver()
	if dialect == nil {
		return "", fmt.Errorf("unsupported database driver")
	}
	return dialect.Ident(value)
}

func (h *LegacyDatabaseHelper) InTransaction(ctx context.Context, fn func(context.Context) error) error {
	if txProvider, ok := h.DB.(interface {
		InTransaction(context.Context, func(context.Context) error) error
	}); ok {
		return txProvider.InTransaction(ctx, fn)
	}
	return fn(ctx)
}

// Get a resource version from the max value the updated field
func (h *LegacyDatabaseHelper) GetResourceVersion(ctx context.Context, table string, column string) (int64, error) {
	table = h.Table(table)
	dialect := h.DialectForDriver()
	if dialect == nil {
		return 0, fmt.Errorf("unsupported database driver")
	}

	quotedTable, err := dialect.Ident(table)
	if err != nil {
		return 0, err
	}
	quotedColumn, err := dialect.Ident(column)
	if err != nil {
		return 0, err
	}

	var rv sql.NullInt64
	err = h.Session().Get(ctx, &rv, fmt.Sprintf(
		"SELECT %s FROM %s",
		maxUpdatedValueExpr(h.Session().DriverName(), quotedColumn),
		quotedTable,
	))
	if err != nil && err != sql.ErrNoRows {
		return 0, err
	}

	// When no RV, use a stable non-zero number
	if !rv.Valid || rv.Int64 < 1 {
		return startup, nil
	}
	return rv.Int64, nil
}

var startup = time.Now().UnixMilli()

func maxUpdatedValueExpr(driverName string, quotedColumn string) string {
	switch driverName {
	case "mysql":
		return fmt.Sprintf("CAST(UNIX_TIMESTAMP(MAX(%s)) * 1000 AS SIGNED)", quotedColumn)
	case "postgres", "pgx":
		return fmt.Sprintf("CAST(EXTRACT(EPOCH FROM MAX(%s)) * 1000 AS BIGINT)", quotedColumn)
	case "sqlite", "sqlite3":
		return fmt.Sprintf("CAST(strftime('%%s', MAX(%s)) * 1000 AS INTEGER)", quotedColumn)
	default:
		return fmt.Sprintf("MAX(%s)", quotedColumn)
	}
}

type mysqlConstraintDialect struct{}

func (mysqlConstraintDialect) IsUniqueConstraintViolation(err error) bool {
	var mysqlErr *mysql.MySQLError
	return errors.As(err, &mysqlErr) && mysqlErr.Number == 1062
}

func (mysqlConstraintDialect) ErrorMessage(err error) string {
	var mysqlErr *mysql.MySQLError
	if errors.As(err, &mysqlErr) {
		return mysqlErr.Message
	}
	return err.Error()
}

type postgresConstraintDialect struct{}

func (postgresConstraintDialect) IsUniqueConstraintViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && string(pqErr.Code) == "23505"
}

func (postgresConstraintDialect) ErrorMessage(err error) string {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Error()
	}
	var pqErr *pq.Error
	if errors.As(err, &pqErr) {
		return pqErr.Error()
	}
	return err.Error()
}

type sqliteConstraintDialect struct{}

func (sqliteConstraintDialect) IsUniqueConstraintViolation(err error) bool {
	return sqlite.IsUniqueConstraintViolation(err)
}

func (sqliteConstraintDialect) ErrorMessage(err error) string {
	return sqlite.ErrorMessage(err)
}

type genericConstraintDialect struct{}

func (genericConstraintDialect) IsUniqueConstraintViolation(error) bool {
	return false
}

func (genericConstraintDialect) ErrorMessage(err error) string {
	return err.Error()
}
