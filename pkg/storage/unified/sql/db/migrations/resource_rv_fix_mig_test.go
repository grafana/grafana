package migrations

import (
	"context"
	"database/sql"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	migrator "github.com/grafana/grafana/pkg/storage/sqlutil/migrator"
	_ "github.com/grafana/grafana/pkg/util/sqlite"
)

type rvRow struct {
	ResourceVersion         int64
	PreviousResourceVersion int64
}

func TestSmallRVFixMigration_MovesMultipleBlockingRVsAndUpdatesPrevRefs(t *testing.T) {
	db, err := sql.Open("sqlite3", "file::memory:?cache=shared")
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, db.Close())
	})

	require.NoError(t, createRVFixTestTables(db))

	group := "dashboard.grafana.app"
	resource := "dashboards"
	namespace := "stacks-1"

	badCreateRVs := []int64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	names := make([]string, 0, len(badCreateRVs))
	for i, rv := range badCreateRVs {
		name := fmt.Sprintf("obj-%02d", i)
		names = append(names, name)
		require.NoError(t, insertHistoryRow(db,
			fmt.Sprintf("create-%02d", i), group, resource, namespace, name, rv, 0, 1))
	}

	for i := range badCreateRVs {
		updateRV := rvFloor + 30 + int64(i)
		require.NoError(t, insertHistoryRow(db,
			fmt.Sprintf("update-%02d", i), group, resource, namespace, names[i], updateRV, badCreateRVs[i], 2))
		require.NoError(t, insertResourceRow(db,
			fmt.Sprintf("res-update-%02d", i), group, resource, namespace, names[i], updateRV, badCreateRVs[i]))
	}

	blockingRVs := []int64{rvFloor + 3, rvFloor + 4, rvFloor + 5}
	for i, rv := range blockingRVs {
		require.NoError(t, insertHistoryRow(db,
			fmt.Sprintf("block-%d", i), group, resource, namespace, fmt.Sprintf("block-%d", i), rv, 0, 1))
	}

	require.NoError(t, insertHistoryRow(db,
		"follower-h", group, resource, namespace, "follower-h", rvFloor+60, blockingRVs[0], 2))
	require.NoError(t, insertResourceRow(db,
		"res-at-ceiling", group, resource, namespace, "res-at-ceiling", blockingRVs[0], 0))
	require.NoError(t, insertResourceRow(db,
		"res-ref-prev", group, resource, namespace, "res-ref-prev", rvFloor+70, blockingRVs[0]))

	mg := migrator.NewMigrator(testMigratorHandle{db: db, driverName: migrator.SQLite})
	mig := &SmallRVFixMigration{}

	tx, err := db.BeginTx(context.Background(), nil)
	require.NoError(t, err)
	require.NoError(t, mig.Exec(context.Background(), tx, mg))
	require.NoError(t, tx.Commit())

	for i := range badCreateRVs {
		row := getHistoryRVRow(t, db, fmt.Sprintf("create-%02d", i))
		require.Equal(t, rvFloor+int64(i), row.ResourceVersion)
		require.Equal(t, int64(0), row.PreviousResourceVersion)
	}

	for i := range badCreateRVs {
		historyUpdate := getHistoryRVRow(t, db, fmt.Sprintf("update-%02d", i))
		require.Equal(t, rvFloor+30+int64(i), historyUpdate.ResourceVersion)
		require.Equal(t, rvFloor+int64(i), historyUpdate.PreviousResourceVersion)

		resourceUpdate := getResourceRVRow(t, db, fmt.Sprintf("res-update-%02d", i))
		require.Equal(t, rvFloor+30+int64(i), resourceUpdate.ResourceVersion)
		require.Equal(t, rvFloor+int64(i), resourceUpdate.PreviousResourceVersion)
	}

	for i := range blockingRVs {
		row := getHistoryRVRow(t, db, fmt.Sprintf("block-%d", i))
		require.Equal(t, rvFloor+10+int64(i), row.ResourceVersion)
	}

	follower := getHistoryRVRow(t, db, "follower-h")
	require.Equal(t, rvFloor+10, follower.PreviousResourceVersion)

	resAtCeiling := getResourceRVRow(t, db, "res-at-ceiling")
	require.Equal(t, rvFloor+10, resAtCeiling.ResourceVersion)

	resRefPrev := getResourceRVRow(t, db, "res-ref-prev")
	require.Equal(t, rvFloor+10, resRefPrev.PreviousResourceVersion)
}

func createRVFixTestTables(db *sql.DB) error {
	_, err := db.Exec(`
CREATE TABLE resource_history (
	guid TEXT PRIMARY KEY,
	resource_version BIGINT,
	"group" TEXT NOT NULL,
	resource TEXT NOT NULL,
	namespace TEXT NOT NULL,
	name TEXT NOT NULL,
	action INTEGER NOT NULL,
	folder TEXT,
	previous_resource_version BIGINT,
	key_path TEXT NOT NULL DEFAULT ''
)`)
	if err != nil {
		return err
	}

	_, err = db.Exec(`
CREATE TABLE resource (
	guid TEXT PRIMARY KEY,
	resource_version BIGINT,
	"group" TEXT NOT NULL,
	resource TEXT NOT NULL,
	namespace TEXT NOT NULL,
	name TEXT NOT NULL,
	previous_resource_version BIGINT
)`)
	return err
}

func insertHistoryRow(db *sql.DB, guid, group, resource, namespace, name string, rv, prevRV, action int64) error {
	_, err := db.Exec(`
INSERT INTO resource_history
	(guid, resource_version, "group", resource, namespace, name, action, folder, previous_resource_version, key_path)
VALUES
	(?, ?, ?, ?, ?, ?, ?, '', ?, '')`,
		guid, rv, group, resource, namespace, name, action, prevRV)
	return err
}

func insertResourceRow(db *sql.DB, guid, group, resource, namespace, name string, rv, prevRV int64) error {
	_, err := db.Exec(`
INSERT INTO resource
	(guid, resource_version, "group", resource, namespace, name, previous_resource_version)
VALUES
	(?, ?, ?, ?, ?, ?, ?)`,
		guid, rv, group, resource, namespace, name, prevRV)
	return err
}

func getHistoryRVRow(t *testing.T, db *sql.DB, guid string) rvRow {
	t.Helper()

	row := rvRow{}
	err := db.QueryRow(`
SELECT resource_version, previous_resource_version
FROM resource_history
WHERE guid = ?`, guid).Scan(&row.ResourceVersion, &row.PreviousResourceVersion)
	require.NoError(t, err)
	return row
}

func getResourceRVRow(t *testing.T, db *sql.DB, guid string) rvRow {
	t.Helper()

	row := rvRow{}
	err := db.QueryRow(`
SELECT resource_version, previous_resource_version
FROM resource
WHERE guid = ?`, guid).Scan(&row.ResourceVersion, &row.PreviousResourceVersion)
	require.NoError(t, err)
	return row
}

type testMigratorHandle struct {
	db         *sql.DB
	driverName string
}

func (h testMigratorHandle) DriverName() string {
	return h.driverName
}

func (h testMigratorHandle) SqlDB() *sql.DB {
	return h.db
}
