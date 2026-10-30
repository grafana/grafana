package sql

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"testing/synctest"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
)

const keyPathReconciliationImportTable = `CREATE TABLE resource_last_import_time (
	"group" TEXT NOT NULL, resource TEXT NOT NULL, namespace TEXT NOT NULL,
	last_import_time DATETIME NOT NULL, PRIMARY KEY ("group", resource, namespace)
)`

func newKeyPathReconciliationDB(t *testing.T) db.DB {
	t.Helper()
	database, err := sql.Open("sqlite3", ":memory:")
	require.NoError(t, err)
	database.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, database.Close()) })
	_, err = database.ExecContext(t.Context(), `CREATE TABLE resource_history (
		guid TEXT PRIMARY KEY, "group" TEXT NOT NULL, resource TEXT NOT NULL,
		namespace TEXT NOT NULL, name TEXT NOT NULL, resource_version BIGINT NOT NULL,
		action INTEGER NOT NULL, folder TEXT NOT NULL, key_path TEXT NOT NULL DEFAULT '', value BLOB
	)`)
	require.NoError(t, err)
	_, err = database.ExecContext(t.Context(), keyPathReconciliationImportTable)
	require.NoError(t, err)
	return dbimpl.NewDB(database, "sqlite3")
}

func insertKeyPathReconciliationRow(t *testing.T, database db.DB, guid, namespace string, rv int64, action int, keyPath string) {
	t.Helper()
	_, err := database.ExecContext(t.Context(), `INSERT INTO resource_history
		(guid, "group", resource, namespace, name, resource_version, action, folder, key_path, value)
		VALUES (?, 'group', 'resources', ?, 'name', ?, ?, ?, ?, ?)`, guid, namespace, rv, action, "folder'quoted", keyPath, []byte("unchanged"))
	require.NoError(t, err)
}

func TestReconcileResourceHistoryKeyPaths(t *testing.T) {
	database := newKeyPathReconciliationDB(t)
	const microRV = int64(1700000000000123)
	const snowflakeRV = int64(1724551110456246395)
	for action := 1; action <= 3; action++ {
		insertKeyPathReconciliationRow(t, database, fmt.Sprint(action), "default", microRV, action, "")
	}
	insertKeyPathReconciliationRow(t, database, "4", "", microRV, 1, "")
	insertKeyPathReconciliationRow(t, database, "5", "default", snowflakeRV, 2, "")
	insertKeyPathReconciliationRow(t, database, "populated", "default", microRV, 1, "keep-this-path")

	for _, expected := range []int{2, 2, 1, 0, 0} {
		count, err := reconcileResourceHistoryKeyPaths(t.Context(), database, 2)
		require.NoError(t, err)
		require.Equal(t, expected, count)
	}

	for guid, expectedPath := range map[string]string{
		"1":         "unified/data/group/resources/default/name/1724551110456246395~created~folder'quoted",
		"2":         "unified/data/group/resources/default/name/1724551110456246395~updated~folder'quoted",
		"3":         "unified/data/group/resources/default/name/1724551110456246395~deleted~folder'quoted",
		"4":         "unified/data/group/resources/name/1724551110456246395~created~folder'quoted",
		"5":         "unified/data/group/resources/default/name/1724551110456246395~updated~folder'quoted",
		"populated": "keep-this-path",
	} {
		var keyPath string
		var value []byte
		var rv int64
		require.NoError(t, database.QueryRowContext(t.Context(), "SELECT key_path, value, resource_version FROM resource_history WHERE guid = ?", guid).Scan(&keyPath, &value, &rv))
		require.Equal(t, expectedPath, keyPath)
		require.Equal(t, []byte("unchanged"), value)
		if guid == "5" {
			require.Equal(t, snowflakeRV, rv)
		} else {
			require.Equal(t, microRV, rv)
		}
	}

	// A late old writer can commit a resource version older than every repaired row.
	insertKeyPathReconciliationRow(t, database, "late", "default", microRV-1000, 3, "")
	count, err := reconcileResourceHistoryKeyPaths(t.Context(), database, 2)
	require.NoError(t, err)
	require.Equal(t, 1, count)
	count, err = reconcileResourceHistoryKeyPaths(t.Context(), database, 2)
	require.NoError(t, err)
	require.Zero(t, count)
}

type keyPathConcurrentUpdateDB struct {
	db.DB
	beforeUpdate func()
}

func (d keyPathConcurrentUpdateDB) WithTx(ctx context.Context, opts *sql.TxOptions, fn db.TxFunc) error {
	d.beforeUpdate()
	return d.DB.WithTx(ctx, opts, fn)
}

func TestReconcileResourceHistoryKeyPathsDoesNotOverwriteConcurrentRepair(t *testing.T) {
	database := newKeyPathReconciliationDB(t)
	insertKeyPathReconciliationRow(t, database, "guid'quoted", "default", 1700000000000123, 1, "")
	concurrent := keyPathConcurrentUpdateDB{DB: database, beforeUpdate: func() {
		_, err := database.ExecContext(t.Context(), "UPDATE resource_history SET key_path = 'concurrently-filled'")
		require.NoError(t, err)
	}}
	count, err := reconcileResourceHistoryKeyPaths(t.Context(), concurrent, 2)
	require.NoError(t, err)
	require.Equal(t, 1, count)
	var keyPath string
	require.NoError(t, database.QueryRowContext(t.Context(), "SELECT key_path FROM resource_history").Scan(&keyPath))
	require.Equal(t, "concurrently-filled", keyPath)
	var markerCount int
	require.NoError(t, database.QueryRowContext(t.Context(), "SELECT COUNT(*) FROM resource_last_import_time").Scan(&markerCount))
	require.Zero(t, markerCount, "no index rebuild is needed when this worker repairs no rows")
}

func TestReconcileResourceHistoryKeyPathsMarksAffectedIndexes(t *testing.T) {
	database := newKeyPathReconciliationDB(t)
	oldImportTime := time.Date(2020, time.January, 1, 0, 0, 0, 0, time.UTC)
	for _, row := range []struct {
		guid      string
		namespace string
		group     string
		resource  string
		keyPath   string
	}{
		{guid: "first", namespace: "default", group: "group", resource: "resources"},
		{guid: "second", namespace: "default", group: "group", resource: "resources"},
		{guid: "other-namespace", namespace: "other", group: "group", resource: "resources"},
		{guid: "other-group", namespace: "default", group: "other", resource: "resources"},
		{guid: "other-resource", namespace: "default", group: "group", resource: "other"},
		{guid: "populated", namespace: "untouched", group: "group", resource: "resources", keyPath: "keep-this-path"},
	} {
		insertKeyPathReconciliationRow(t, database, row.guid, row.namespace, 1700000000000123, 1, row.keyPath)
		_, err := database.ExecContext(t.Context(), `UPDATE resource_history SET "group" = ?, resource = ? WHERE guid = ?`, row.group, row.resource, row.guid)
		require.NoError(t, err)
		_, err = database.ExecContext(t.Context(), `INSERT OR IGNORE INTO resource_last_import_time ("group", resource, namespace, last_import_time) VALUES (?, ?, ?, ?)`, row.group, row.resource, row.namespace, oldImportTime)
		require.NoError(t, err)
	}

	count, err := reconcileResourceHistoryKeyPaths(t.Context(), database, 100)
	require.NoError(t, err)
	require.Equal(t, 5, count)
	var marked, unchanged int
	require.NoError(t, database.QueryRowContext(t.Context(), "SELECT COUNT(*) FROM resource_last_import_time WHERE last_import_time != ?", oldImportTime).Scan(&marked))
	require.Equal(t, 4, marked, "only the distinct affected namespace/group/resource indexes are marked")
	require.NoError(t, database.QueryRowContext(t.Context(), "SELECT COUNT(*) FROM resource_last_import_time WHERE last_import_time = ? AND namespace = 'untouched'", oldImportTime).Scan(&unchanged))
	require.Equal(t, 1, unchanged)

	// A clean pass must not request another index rebuild.
	_, err = database.ExecContext(t.Context(), "UPDATE resource_last_import_time SET last_import_time = ?", oldImportTime)
	require.NoError(t, err)
	count, err = reconcileResourceHistoryKeyPaths(t.Context(), database, 100)
	require.NoError(t, err)
	require.Zero(t, count)
	require.NoError(t, database.QueryRowContext(t.Context(), "SELECT COUNT(*) FROM resource_last_import_time WHERE last_import_time != ?", oldImportTime).Scan(&marked))
	require.Zero(t, marked)
}

func TestReconcileResourceHistoryKeyPathsMarkerUsesCurrentTime(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		synctest.Sleep(1500 * time.Millisecond)
		database := newKeyPathReconciliationDB(t)
		insertKeyPathReconciliationRow(t, database, "repair", "default", 1700000000000123, 1, "")
		expected := time.Now().UTC().Truncate(time.Second)
		_, err := reconcileResourceHistoryKeyPaths(t.Context(), database, 100)
		require.NoError(t, err)
		var repairedAt time.Time
		require.NoError(t, database.QueryRowContext(t.Context(), "SELECT last_import_time FROM resource_last_import_time").Scan(&repairedAt))
		require.Equal(t, expected, repairedAt.UTC(), "repair markers use the current time at KV key precision, not the transaction deadline")

		synctest.Sleep(time.Second)
		importedAt := time.Now().UTC().Truncate(time.Second)
		b := &backend{dialect: sqltemplate.SQLite}
		require.NoError(t, b.updateLastImportTime(t.Context(), database, &resourcepb.ResourceKey{
			Namespace: "default", Group: "group", Resource: "resources",
		}, importedAt))
		var latest time.Time
		require.NoError(t, database.QueryRowContext(t.Context(), "SELECT last_import_time FROM resource_last_import_time").Scan(&latest))
		require.Equal(t, importedAt, latest.UTC())
		require.True(t, latest.After(repairedAt), "a subsequent import must advance the marker even before the repair transaction's deadline")
	})
}

func TestReconcileResourceHistoryKeyPathsMarkersCanBeDeleted(t *testing.T) {
	database := newKeyPathReconciliationDB(t)
	insertKeyPathReconciliationRow(t, database, "repair", "default", 1700000000000123, 1, "")
	_, err := reconcileResourceHistoryKeyPaths(t.Context(), database, 100)
	require.NoError(t, err)

	store, err := kv.NewSQLKV(database.SqlDB(), database.DriverName())
	require.NoError(t, err)
	var keys []string
	for key, err := range store.Keys(t.Context(), kv.LastImportTimeSection, kv.ListOptions{}) {
		require.NoError(t, err)
		keys = append(keys, key)
	}
	require.Len(t, keys, 1)
	// Cleanup deletes the timestamp reconstructed from the key, which has only
	// second precision even when the database can preserve fractional seconds.
	require.NoError(t, store.Delete(t.Context(), kv.LastImportTimeSection, keys[0]))
	var markerCount int
	require.NoError(t, database.QueryRowContext(t.Context(), "SELECT COUNT(*) FROM resource_last_import_time").Scan(&markerCount))
	require.Zero(t, markerCount)
}

func TestReconcileResourceHistoryKeyPathsRollsBackIfRebuildMarkerFails(t *testing.T) {
	database := newKeyPathReconciliationDB(t)
	insertKeyPathReconciliationRow(t, database, "repair", "default", 1700000000000123, 1, "")
	_, err := database.ExecContext(t.Context(), "DROP TABLE resource_last_import_time")
	require.NoError(t, err)

	count, err := reconcileResourceHistoryKeyPaths(t.Context(), database, 100)
	require.ErrorContains(t, err, "mark repaired resource index for rebuild")
	require.Zero(t, count)
	var keyPath string
	require.NoError(t, database.QueryRowContext(t.Context(), "SELECT key_path FROM resource_history").Scan(&keyPath))
	require.Empty(t, keyPath, "a failed marker write must leave the row eligible for retry")

	_, err = database.ExecContext(t.Context(), keyPathReconciliationImportTable)
	require.NoError(t, err)
	count, err = reconcileResourceHistoryKeyPaths(t.Context(), database, 100)
	require.NoError(t, err)
	require.Equal(t, 1, count)
	var markerCount int
	require.NoError(t, database.QueryRowContext(t.Context(), "SELECT COUNT(*) FROM resource_last_import_time").Scan(&markerCount))
	require.Equal(t, 1, markerCount)
}

func TestReconcileResourceHistoryKeyPathsRejectsUnknownAction(t *testing.T) {
	database := newKeyPathReconciliationDB(t)
	insertKeyPathReconciliationRow(t, database, "invalid", "default", 1700000000000123, 0, "")
	_, err := reconcileResourceHistoryKeyPaths(t.Context(), database, 2)
	require.ErrorContains(t, err, "unsupported action 0")
}

func TestReconcileResourceHistoryKeyPathsDialects(t *testing.T) {
	for _, driver := range []string{"sqlite3", "mysql", "postgres"} {
		t.Run(driver, func(t *testing.T) {
			database, mock, err := sqlmock.New(sqlmock.QueryMatcherOption(sqlmock.QueryMatcherEqual))
			require.NoError(t, err)
			t.Cleanup(func() { _ = database.Close() })
			columns := []string{"guid", "group", "resource", "namespace", "name", "resource_version", "action", "folder"}
			selectQuery := `SELECT "guid", "group", "resource", "namespace", "name", "resource_version", "action", "folder" FROM resource_history WHERE key_path = '' LIMIT 100`
			if driver == "mysql" {
				selectQuery = "SELECT `guid`, `group`, `resource`, `namespace`, `name`, `resource_version`, `action`, `folder` FROM resource_history WHERE key_path = '' LIMIT 100"
			}
			mock.ExpectQuery(selectQuery).WillReturnRows(sqlmock.NewRows(columns).
				AddRow("first", "group", "resources", "ns", "one", 1700000000000123, 1, "").
				AddRow("second", "group", "resources", "ns", "two", 1700000000000123, 3, "folder")).RowsWillBeClosed()
			updateQuery := "UPDATE resource_history SET key_path = CASE guid WHEN ? THEN ? WHEN ? THEN ? ELSE key_path END WHERE key_path = '' AND guid IN (?, ?)"
			if driver == "postgres" {
				updateQuery = "UPDATE resource_history SET key_path = CASE guid WHEN $1 THEN $2 WHEN $3 THEN $4 ELSE key_path END WHERE key_path = '' AND guid IN ($5, $6)"
			}
			mock.ExpectBegin()
			mock.ExpectExec(updateQuery).WithArgs("first", "unified/data/group/resources/ns/one/1724551110456246395~created~",
				"second", "unified/data/group/resources/ns/two/1724551110456246395~deleted~folder", "first", "second").
				WillReturnResult(sqlmock.NewResult(0, 2))
			switch driver {
			case "mysql":
				markerQuery := "INSERT INTO `resource_last_import_time` (`group`, `resource`, `namespace`, `last_import_time`) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE `last_import_time` = ?;"
				mock.ExpectExec(markerQuery).WithArgs("group", "resources", "ns", sqlmock.AnyArg(), sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(0, 1))
			case "postgres":
				markerQuery := `INSERT INTO "resource_last_import_time" ("group", "resource", "namespace", "last_import_time") VALUES ($1, $2, $3, $4) ON CONFLICT ("group", "resource", "namespace") DO UPDATE SET "last_import_time" = $5;`
				mock.ExpectExec(markerQuery).WithArgs("group", "resources", "ns", sqlmock.AnyArg(), sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(0, 1))
			default:
				markerQuery := `INSERT OR REPLACE INTO "resource_last_import_time" ("group", "resource", "namespace", "last_import_time") VALUES (?, ?, ?, ?);`
				mock.ExpectExec(markerQuery).WithArgs("group", "resources", "ns", sqlmock.AnyArg()).WillReturnResult(sqlmock.NewResult(0, 1))
			}
			mock.ExpectCommit()
			count, err := reconcileResourceHistoryKeyPaths(t.Context(), dbimpl.NewDB(database, driver), 100)
			require.NoError(t, err)
			require.Equal(t, 2, count)
			require.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

func TestNewStorageBackendKeyPathReconciliation(t *testing.T) {
	for _, enabled := range []bool{false, true} {
		t.Run(fmt.Sprint(enabled), func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.EnableSQLKVBackend = true
			cfg.KeyPathReconciliationEnabled = enabled
			backend, err := NewStorageBackend(cfg, nil, prometheus.NewRegistry(), nil, true, testKV(t), nil,
				func(opts *resource.KVBackendOptions) {
					require.Equal(t, enabled, opts.ReconcileKeyPaths != nil)
				})
			require.NoError(t, err)
			t.Cleanup(func() { require.NoError(t, backend.(resource.ResourceServerStopper).Stop(context.Background())) })
		})
	}
}
