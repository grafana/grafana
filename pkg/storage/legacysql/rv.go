package legacysql

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

// The database may depend on the request context
type NamespacedDBProvider func(ctx context.Context) (db.DB, error)

// Get the list RV from the maximum updated time
type ResourceVersionLookup = func(ctx context.Context) (int64, error)

// Get a resource version from the max value the updated field
func GetResourceVersionLookup(sql NamespacedDBProvider, table string, column string) ResourceVersionLookup {
	return func(ctx context.Context) (int64, error) {
		db, err := sql(ctx)
		if err != nil {
			return 1, err
		}

		table = db.GetDialect().Quote(table)
		column = db.GetDialect().Quote(column)
		switch db.GetDBType() {
		case migrator.Postgres:
			max := time.Now()
			err := db.GetSqlxSession().Get(ctx, &max, "SELECT MAX("+column+") FROM "+table)
			if err != nil {
				return 1, nil
			}
			return max.UnixMilli(), nil
		case migrator.MySQL:
			max := int64(1)
			_ = db.GetSqlxSession().Get(ctx, &max, "SELECT UNIX_TIMESTAMP(MAX("+column+")) FROM "+table)
			return max, nil
		default:
			// fallthrough to string version
		}

		max := ""
		err = db.GetSqlxSession().Get(ctx, &max, "SELECT MAX("+column+") FROM "+table)
		if err == nil && max != "" {
			t, _ := time.Parse(time.DateTime, max) // ignore null errors
			return t.UnixMilli(), nil
		}
		return 1, nil
	}
}
