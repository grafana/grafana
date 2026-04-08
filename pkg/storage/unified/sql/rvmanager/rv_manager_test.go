package rvmanager

import (
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/bwmarrin/snowflake"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"github.com/grafana/grafana/pkg/storage/unified/sql/test"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func expectSuccessfulResourceVersionLock(t *testing.T, dbp test.TestDBProvider, rv int64, timestamp int64) {
	dbp.SQLMock.ExpectQuery("select resource_version, unix_timestamp for update").
		WillReturnRows(sqlmock.NewRows([]string{"resource_version", "unix_timestamp"}).
			AddRow(rv, timestamp))
}

func expectSuccessfulResourceVersionSaveRV(t *testing.T, dbp test.TestDBProvider) {
	dbp.SQLMock.ExpectExec("update resource set resource_version").WillReturnResult(sqlmock.NewResult(1, 1))
	dbp.SQLMock.ExpectExec("update resource_history set resource_version").WillReturnResult(sqlmock.NewResult(1, 1))
	dbp.SQLMock.ExpectExec("update resource_version set resource_version").WillReturnResult(sqlmock.NewResult(1, 1))
}

func expectSuccessfulResourceVersionExec(t *testing.T, dbp test.TestDBProvider, cbs ...func()) {
	for _, cb := range cbs {
		cb()
	}
	expectSuccessfulResourceVersionLock(t, dbp, 100, 200)
	expectSuccessfulResourceVersionSaveRV(t, dbp)
}

func TestResourceVersionManager(t *testing.T) {
	ctx := testutil.NewDefaultTestContext(t)
	dbp := test.NewDBProviderMatchWords(t)
	dialect := sqltemplate.DialectForDriver(dbp.DB.DriverName())
	manager, err := NewResourceVersionManager(ResourceManagerOptions{
		DB:      dbp.DB,
		Dialect: dialect,
	})
	require.NoError(t, err)
	require.NotNil(t, manager)

	t.Run("should handle single operation", func(t *testing.T) {
		key := &resourcepb.ResourceKey{
			Group:    "test-group",
			Resource: "test-resource",
		}
		dbp.SQLMock.ExpectBegin()
		expectSuccessfulResourceVersionExec(t, dbp, func() {
			dbp.SQLMock.ExpectExec("select 1").WillReturnResult(sqlmock.NewResult(1, 1))
		})
		dbp.SQLMock.ExpectCommit()

		rv, err := manager.ExecWithRV(ctx, key, func(tx db.Tx) (string, error) {
			_, err := tx.ExecContext(ctx, "select 1")
			return "1234", err
		})
		require.NoError(t, err)
		require.Equal(t, rv, int64(200))
	})
}

func TestSnowflakeFromRVRoundtrips(t *testing.T) {
	// 2026-01-12 19:33:58.806211 +0000 UTC
	offset := int64(1768246438806211) // in microseconds

	for n := range int64(100) {
		ts := offset + n
		require.Equal(t, ts, RVFromSnowflake(SnowflakeFromRV(ts)))
	}
}

func TestBulkSnowflakeRoundtrip(t *testing.T) {
	// Replicate the snowflakeFromTime formula from resource/eventstore.go:
	// snowflake id with node and step bits zeroed out.
	shift := snowflake.NodeBits + snowflake.StepBits
	base := (time.Now().UnixMilli() - snowflake.Epoch) << shift

	t.Run("old formula fails for counter >= 1000", func(t *testing.T) {
		for counter := int64(1000); counter <= 1005; counter++ {
			snowflakeID := base + counter // old: directly add counter
			microRV := RVFromSnowflake(snowflakeID)
			roundtripped := SnowflakeFromRV(microRV)
			require.NotEqual(t, snowflakeID, roundtripped,
				"expected roundtrip to fail at counter=%d with old formula", counter)
		}
	})

	t.Run("new formula roundtrips for all counters", func(t *testing.T) {
		for counter := int64(1); counter <= 2000; counter++ {
			// New formula: overflow into ms portion when counter >= 1000
			msOffset := counter / 1000
			subMs := counter % 1000
			snowflakeID := base + (msOffset << shift) + subMs

			microRV := RVFromSnowflake(snowflakeID)
			roundtripped := SnowflakeFromRV(microRV)

			require.Equal(t, snowflakeID, roundtripped,
				"roundtrip failed at counter=%d: snowflake=%d -> microRV=%d -> roundtripped=%d",
				counter, snowflakeID, microRV, roundtripped)
		}
	})
}
