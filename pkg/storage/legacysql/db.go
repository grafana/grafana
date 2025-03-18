package legacysql

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

// The database may depend on the request context
type LegacyDatabaseProvider func(ctx context.Context) (*LegacyDatabaseHelper, error)

// NewDatabaseProvider returns a simple provider that always uses the same database implementation
func NewDatabaseProvider(db db.DB) LegacyDatabaseProvider {
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
	DB db.DB

	// table name locator
	Table func(n string) string
}

// Helper to pick the correct dialect
func (h *LegacyDatabaseHelper) DialectForDriver() sqltemplate.Dialect {
	if h.DB == nil {
		return nil
	}
	return sqltemplate.DialectForDriver(string(h.DB.GetDBType()))
}

// Get a resource version from the max value the updated field
func (h *LegacyDatabaseHelper) GetResourceVersion(ctx context.Context, table string, column string) (int64, error) {
	table = h.Table(table)
	column = h.DB.Quote(column)

	var rv int64
	_ = h.DB.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		v := struct {
			M time.Time `db:"m"` // xorm date parsing magic
		}{}
		ok, err := sess.Table(h.Table(table)).Select("MAX(" + column + ") as m").Get(&v)
		if ok {
			rv = v.M.UnixMilli()
			return nil
		}
		return err
	})

	// When no RV, use a stable non-zero number
	if rv < 1 {
		return startup, nil
	}
	return rv, nil
}

var startup = time.Now().UnixMilli()
