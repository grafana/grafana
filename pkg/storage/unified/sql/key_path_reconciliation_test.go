package sql

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
)

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

func (d keyPathConcurrentUpdateDB) ExecContext(ctx context.Context, query string, args ...any) (db.Result, error) {
	d.beforeUpdate()
	return d.DB.ExecContext(ctx, query, args...)
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
			mock.ExpectExec(updateQuery).WithArgs("first", "unified/data/group/resources/ns/one/1724551110456246395~created~",
				"second", "unified/data/group/resources/ns/two/1724551110456246395~deleted~folder", "first", "second").
				WillReturnResult(sqlmock.NewResult(0, 2))
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
