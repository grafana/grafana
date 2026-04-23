package rvmanager

import (
	"context"
	"errors"
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

		rv, err := manager.ExecWithRV(ctx, key, func(txnCtx context.Context, tx db.Tx) (string, error) {
			_, err := tx.ExecContext(txnCtx, "select 1")
			return "1234", err
		})
		require.NoError(t, err)
		require.Equal(t, rv, int64(200))
	})
}

// TestExecWithRV_transactionContextRegression guards against using the request
// context (passed to ExecWithRV) for ExecContext on the batch sql.Tx. The batch
// runs inside db.WithTx with a separate context from the batch processor; if
// ExecContext uses a caller context that gets canceled mid-batch, the driver
// can invalidate the transaction and the next Exec fails with "transaction has
// already been committed or rolled back" (seen as flaky resource_history
// writes during provisioning incremental sync).
func TestExecWithRV_transactionContextRegression(t *testing.T) {
	ctx := testutil.NewDefaultTestContext(t)

	t.Run("txn_context_allows_second_exec_after_request_context_cancelled", func(t *testing.T) {
		dbp := test.NewDBProviderMatchWords(t)
		dialect := sqltemplate.DialectForDriver(dbp.DB.DriverName())
		manager, err := NewResourceVersionManager(ResourceManagerOptions{
			DB:      dbp.DB,
			Dialect: dialect,
		})
		require.NoError(t, err)

		key := &resourcepb.ResourceKey{Group: "txn-ctx-ok", Resource: "res"}
		// ExecWithRV must not use a context we cancel here — its select would
		// return early. The production bug was the *write path* closing over the
		// same canceled request context for tx.ExecContext, not ExecWithRV racing.
		waitCtx := ctx
		requestCtx, cancelRequest := context.WithCancel(ctx)

		dbp.SQLMock.ExpectBegin()
		expectSuccessfulResourceVersionExec(t, dbp, func() {
			dbp.SQLMock.ExpectExec("select 1").WillReturnResult(sqlmock.NewResult(1, 1))
			dbp.SQLMock.ExpectExec("select 2").WillReturnResult(sqlmock.NewResult(1, 1))
		})
		dbp.SQLMock.ExpectCommit()

		_, err = manager.ExecWithRV(waitCtx, key, func(txnCtx context.Context, tx db.Tx) (string, error) {
			if _, err := tx.ExecContext(txnCtx, "select 1"); err != nil {
				return "", err
			}
			cancelRequest()
			require.ErrorIs(t, requestCtx.Err(), context.Canceled)
			require.NoError(t, txnCtx.Err(), "batch txn context must remain usable after request cancellation")
			_, err := tx.ExecContext(txnCtx, "select 2")
			return "1234", err
		})
		require.NoError(t, err)
	})

	t.Run("cancelled_request_context_fails_second_exec", func(t *testing.T) {
		dbp := test.NewDBProviderMatchWords(t)
		dialect := sqltemplate.DialectForDriver(dbp.DB.DriverName())
		manager, err := NewResourceVersionManager(ResourceManagerOptions{
			DB:      dbp.DB,
			Dialect: dialect,
		})
		require.NoError(t, err)

		key := &resourcepb.ResourceKey{Group: "txn-ctx-bad", Resource: "res"}
		waitCtx := ctx
		requestCtx, cancelRequest := context.WithCancel(ctx)

		dbp.SQLMock.ExpectBegin()
		dbp.SQLMock.ExpectExec("select 1").WillReturnResult(sqlmock.NewResult(1, 1))
		dbp.SQLMock.ExpectRollback()

		_, err = manager.ExecWithRV(waitCtx, key, func(txnCtx context.Context, tx db.Tx) (string, error) {
			if _, err := tx.ExecContext(txnCtx, "select 1"); err != nil {
				return "", err
			}
			cancelRequest()
			// Pre-fix sql backend passed the request context into dbutil.Exec here;
			// once canceled, database/sql does not run the statement and returns
			// context.Canceled, aborting the batch.
			_, err := tx.ExecContext(requestCtx, "select 2")
			return "", err
		})
		require.Error(t, err)
		require.True(t, errors.Is(err, context.Canceled), "got %v", err)
	})
}

func TestBatchTransactionTimeout_explicitOverride(t *testing.T) {
	dbp := test.NewDBProviderMatchWords(t)
	m, err := NewResourceVersionManager(ResourceManagerOptions{
		DB:                      dbp.DB,
		Dialect:                 sqltemplate.DialectForDriver("mysql"),
		BatchTransactionTimeout: 3 * time.Second,
	})
	require.NoError(t, err)
	require.Equal(t, 3*time.Second, m.batchTransactionTimeout())

	m2, err := NewResourceVersionManager(ResourceManagerOptions{
		DB:      dbp.DB,
		Dialect: sqltemplate.DialectForDriver("mysql"),
	})
	require.NoError(t, err)
	require.Equal(t, defaultBatchTimeout, m2.batchTransactionTimeout())
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
