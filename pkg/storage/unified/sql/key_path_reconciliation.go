package sql

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/dbutil"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

const keyPathReconciliationTransactionTimeout = 30 * time.Second

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
	affectedResources := make(map[resource.NamespacedResource]struct{})
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
		// Search indexes are namespaced, so cluster-scoped rows need no rebuild marker.
		if key.Namespace != "" {
			affectedResources[resource.NamespacedResource{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource}] = struct{}{}
		}
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
	resources := make([]resource.NamespacedResource, 0, len(affectedResources))
	for key := range affectedResources {
		resources = append(resources, key)
	}
	// Use the same lock order across repair workers sharing a database.
	slices.SortFunc(resources, func(a, b resource.NamespacedResource) int {
		return strings.Compare(a.String(), b.String())
	})

	txCtx, cancelTx := context.WithTimeout(ctx, keyPathReconciliationTransactionTimeout)
	defer cancelTx()
	err = database.WithTx(txCtx, nil, func(ctx context.Context, tx db.Tx) error {
		result, err := tx.ExecContext(ctx, query, args...)
		if err != nil {
			return err
		}
		affected, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if affected == 0 {
			return nil
		}

		// Repaired revisions can precede search's checkpoint, so mark indexes for
		// rebuild. Commit the marker with the repair so failures remain retryable.
		// Evaluate database time in each marker statement to narrow the pre-commit
		// visibility window, retaining second precision for KV marker cleanup.
		for _, key := range resources {
			if _, err := dbutil.Exec(ctx, tx, sqlResourceLastImportTimeInsert, sqlResourceLastImportTimeInsertRequest{
				SQLTemplate:     sqltemplate.New(sqltemplate.DialectForDriver(database.DriverName())),
				Namespace:       key.Namespace,
				Group:           key.Group,
				Resource:        key.Resource,
				UseDatabaseTime: true,
			}); err != nil {
				return fmt.Errorf("mark repaired resource index for rebuild: %w", err)
			}
		}
		return nil
	})
	if err != nil {
		return 0, err
	}
	return len(repairs), nil
}
