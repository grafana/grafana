package legacy

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

type ResourceVersionLookup = func(ctx context.Context) (int64, error)

func GetResourceVersionLookup(sql db.DB, table string) ResourceVersionLookup {
	table = sql.GetDialect().Quote(table)

	var max int64
	sess := sql.GetSqlxSession()
	if sql.GetDBType() == migrator.Postgres {
		return func(ctx context.Context) (int64, error) {
			max := time.Now()
			err := sess.Get(ctx, &max, "SELECT MAX(updated) FROM "+table)
			if err != nil {
				return 1, nil
			}
			return max.UnixMilli(), nil
		}
	} else if sql.GetDBType() == migrator.MySQL {
		return func(ctx context.Context) (int64, error) {
			max = 1
			_ = sess.Get(ctx, &max, "SELECT UNIX_TIMESTAMP(MAX(updated)) FROM "+table)
			return max, nil
		}
	}

	// SQLite (as string)
	return func(ctx context.Context) (int64, error) {
		max := ""
		err := sess.Get(ctx, &max, "SELECT MAX(updated) FROM "+table)
		if err == nil && max != "" {
			t, _ := time.Parse(time.DateTime, max) // ignore null errors
			return t.UnixMilli(), nil
		}
		return 1, nil
	}
}
