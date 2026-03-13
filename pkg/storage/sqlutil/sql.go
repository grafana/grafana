package sqlutil

import (
	"context"
	"database/sql"

	storagemigrator "github.com/grafana/grafana/pkg/storage/sqlutil/migrator"
)

type Queryer interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
}

func QueryMaps(ctx context.Context, queryer Queryer, query string, args ...any) ([]map[string][]byte, error) {
	rows, err := queryer.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	raw := make([]sql.RawBytes, len(cols))
	dest := make([]any, len(cols))
	for i := range raw {
		dest[i] = &raw[i]
	}

	results := make([]map[string][]byte, 0)
	for rows.Next() {
		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}
		row := make(map[string][]byte, len(cols))
		for i, col := range cols {
			if raw[i] != nil {
				row[col] = append([]byte(nil), raw[i]...)
			}
		}
		results = append(results, row)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return results, nil
}

func TableExists(ctx context.Context, queryer Queryer, dialect storagemigrator.Dialect, tableName string) (bool, error) {
	sqlText, args := dialect.TableCheckSQL(tableName)
	results, err := QueryMaps(ctx, queryer, sqlText, args...)
	if err != nil {
		return false, err
	}
	return len(results) > 0, nil
}
