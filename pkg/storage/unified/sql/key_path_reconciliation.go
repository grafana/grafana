package sql

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
)

func reconcileResourceHistoryKeyPaths(ctx context.Context, database db.DB, batchSize int) (int, error) {
	if batchSize <= 0 {
		return 0, fmt.Errorf("key path reconciliation batch size must be positive")
	}
	dialect, err := kv.DialectFromDriver(database.DriverName())
	if err != nil {
		return 0, err
	}

	columns := []string{"guid", "group", "resource", "namespace", "name", "resource_version", "action", "folder"}
	for i := range columns {
		columns[i] = dialect.QuoteIdent(columns[i])
	}
	// Always start at the remaining empty paths, including rows committed behind
	// an earlier pass's resource-version watermark.
	query := fmt.Sprintf("SELECT %s FROM resource_history WHERE key_path = '' LIMIT %d", strings.Join(columns, ", "), batchSize)
	rows, err := database.QueryContext(ctx, query)
	if err != nil {
		return 0, err
	}
	defer func() { _ = rows.Close() }()

	type repair struct {
		guid    string
		keyPath string
	}
	repairs := make([]repair, 0, batchSize)
	for rows.Next() {
		var guid string
		var key resource.DataKey
		var action int
		if err := rows.Scan(&guid, &key.Group, &key.Resource, &key.Namespace, &key.Name, &key.ResourceVersion, &action, &key.Folder); err != nil {
			return 0, err
		}
		switch action {
		case 1:
			key.Action = resource.DataActionCreated
		case 2:
			key.Action = resource.DataActionUpdated
		case 3:
			key.Action = resource.DataActionDeleted
		default:
			return 0, fmt.Errorf("resource_history row %s has unsupported action %d", guid, action)
		}
		key.ResourceVersion = resource.ToSnowflakeRV(key.ResourceVersion)
		repairs = append(repairs, repair{guid: guid, keyPath: kv.DataSection + "/" + key.String()})
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	// Release the read connection before writing, including for single-connection SQLite.
	if err := rows.Close(); err != nil {
		return 0, err
	}
	if len(repairs) == 0 {
		return 0, nil
	}

	var cases strings.Builder
	cases.WriteString("CASE guid")
	guids := make([]string, 0, len(repairs))
	args := make([]any, 0, len(repairs)*3)
	for _, repair := range repairs {
		fmt.Fprintf(&cases, " WHEN %s THEN %s", dialect.Placeholder(len(args)+1), dialect.Placeholder(len(args)+2))
		args = append(args, repair.guid, repair.keyPath)
	}
	cases.WriteString(" ELSE key_path END")
	for _, repair := range repairs {
		guids = append(guids, dialect.Placeholder(len(args)+1))
		args = append(args, repair.guid)
	}
	query = fmt.Sprintf("UPDATE resource_history SET key_path = %s WHERE key_path = '' AND guid IN (%s)", cases.String(), strings.Join(guids, ", "))
	if _, err := database.ExecContext(ctx, query, args...); err != nil {
		return 0, err
	}
	return len(repairs), nil
}
