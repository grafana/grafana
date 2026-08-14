package migrations

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/xorm"
)

type rvRow struct {
	ResourceVersion         int64 `xorm:"resource_version"`
	PreviousResourceVersion int64 `xorm:"previous_resource_version"`
}

func TestSmallRVFixMigration_MovesMultipleBlockingRVsAndUpdatesPrevRefs(t *testing.T) {
	engine, err := xorm.NewEngine("sqlite3", "file::memory:?cache=shared")
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, engine.Close())
	})

	require.NoError(t, createRVFixTestTables(engine))

	group := "dashboard.grafana.app"
	resource := "dashboards"
	namespace := "stacks-1"

	// 10 bad create rows (< rvFloor).
	badCreateRVs := []int64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10}
	names := make([]string, 0, len(badCreateRVs))
	for i, rv := range badCreateRVs {
		name := fmt.Sprintf("obj-%02d", i)
		names = append(names, name)
		require.NoError(t, insertHistoryRow(engine,
			fmt.Sprintf("create-%02d", i), group, resource, namespace, name, rv, 0, 1))
	}

	// One update per object, pointing back to each create RV.
	for i := range badCreateRVs {
		updateRV := rvFloor + 30 + int64(i)
		require.NoError(t, insertHistoryRow(engine,
			fmt.Sprintf("update-%02d", i), group, resource, namespace, names[i], updateRV, badCreateRVs[i], 2))
		require.NoError(t, insertResourceRow(engine,
			fmt.Sprintf("res-update-%02d", i), group, resource, namespace, names[i], updateRV, badCreateRVs[i]))
	}

	// Three valid rows close to rvFloor, which block the rewrite window. Test the makeSlotsAvailable logic
	blockingRVs := []int64{rvFloor + 3, rvFloor + 4, rvFloor + 5}
	for i, rv := range blockingRVs {
		require.NoError(t, insertHistoryRow(engine,
			fmt.Sprintf("block-%d", i), group, resource, namespace, fmt.Sprintf("block-%d", i), rv, 0, 1))
	}

	require.NoError(t, insertHistoryRow(engine,
		"follower-h", group, resource, namespace, "follower-h", rvFloor+60, blockingRVs[0], 2))
	require.NoError(t, insertResourceRow(engine,
		"res-at-ceiling", group, resource, namespace, "res-at-ceiling", blockingRVs[0], 0))
	require.NoError(t, insertResourceRow(engine,
		"res-ref-prev", group, resource, namespace, "res-ref-prev", rvFloor+70, blockingRVs[0]))

	mg := migrator.NewMigrator(engine, &setting.Cfg{})
	mig := &SmallRVFixMigration{}

	sess := engine.NewSession()
	t.Cleanup(func() {
		sess.Close()
	})
	require.NoError(t, sess.Begin())
	require.NoError(t, mig.Exec(sess, mg))
	require.NoError(t, sess.Commit())

	// Bad create rows are remapped to the reserved range [rvFloor, rvFloor+10).
	for i := range badCreateRVs {
		row := getHistoryRVRow(t, engine, fmt.Sprintf("create-%02d", i))
		require.Equal(t, rvFloor+int64(i), row.ResourceVersion)
		require.Equal(t, int64(0), row.PreviousResourceVersion)
	}

	// Update rows now point to the remapped create RVs.
	for i := range badCreateRVs {
		historyUpdate := getHistoryRVRow(t, engine, fmt.Sprintf("update-%02d", i))
		require.Equal(t, rvFloor+30+int64(i), historyUpdate.ResourceVersion)
		require.Equal(t, rvFloor+int64(i), historyUpdate.PreviousResourceVersion)

		resourceUpdate := getResourceRVRow(t, engine, fmt.Sprintf("res-update-%02d", i))
		require.Equal(t, rvFloor+30+int64(i), resourceUpdate.ResourceVersion)
		require.Equal(t, rvFloor+int64(i), resourceUpdate.PreviousResourceVersion)
	}

	// Blocking rows are moved to the first available slots at/after rvFloor+10.
	for i := range blockingRVs {
		row := getHistoryRVRow(t, engine, fmt.Sprintf("block-%d", i))
		require.Equal(t, rvFloor+10+int64(i), row.ResourceVersion)
	}

	// previous_resource_version references to moved blocking rows are rewritten.
	follower := getHistoryRVRow(t, engine, "follower-h")
	require.Equal(t, rvFloor+10, follower.PreviousResourceVersion)

	resAtCeiling := getResourceRVRow(t, engine, "res-at-ceiling")
	require.Equal(t, rvFloor+10, resAtCeiling.ResourceVersion)

	resRefPrev := getResourceRVRow(t, engine, "res-ref-prev")
	require.Equal(t, rvFloor+10, resRefPrev.PreviousResourceVersion)
}

func createRVFixTestTables(engine *xorm.Engine) error {
	_, err := engine.Exec(`
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

	_, err = engine.Exec(`
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

func insertHistoryRow(engine *xorm.Engine, guid, group, resource, namespace, name string, rv, prevRV, action int64) error {
	_, err := engine.Exec(`
INSERT INTO resource_history
	(guid, resource_version, "group", resource, namespace, name, action, folder, previous_resource_version, key_path)
VALUES
	(?, ?, ?, ?, ?, ?, ?, '', ?, '')`,
		guid, rv, group, resource, namespace, name, action, prevRV)
	return err
}

func insertResourceRow(engine *xorm.Engine, guid, group, resource, namespace, name string, rv, prevRV int64) error {
	_, err := engine.Exec(`
INSERT INTO resource
	(guid, resource_version, "group", resource, namespace, name, previous_resource_version)
VALUES
	(?, ?, ?, ?, ?, ?, ?)`,
		guid, rv, group, resource, namespace, name, prevRV)
	return err
}

func getHistoryRVRow(t *testing.T, engine *xorm.Engine, guid string) rvRow {
	t.Helper()

	row := rvRow{}
	has, err := engine.SQL(`
SELECT resource_version, previous_resource_version
FROM resource_history
WHERE guid = ?`, guid).Get(&row)
	require.NoError(t, err)
	require.True(t, has)
	return row
}

func getResourceRVRow(t *testing.T, engine *xorm.Engine, guid string) rvRow {
	t.Helper()

	row := rvRow{}
	has, err := engine.SQL(`
SELECT resource_version, previous_resource_version
FROM resource
WHERE guid = ?`, guid).Get(&row)
	require.NoError(t, err)
	require.True(t, has)
	return row
}
