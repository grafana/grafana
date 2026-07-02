package annotation

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// TestBulkInsert_Integration exercises the backfill write path against a real
// Postgres. It is gated on ANNOTATION_TEST_POSTGRES_DSN
//
// The store runs its own migrations on construction, so the target database
// only needs to exist and be reachable.
func TestBulkInsert_Integration(t *testing.T) {
	dsn := os.Getenv("ANNOTATION_TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("set ANNOTATION_TEST_POSTGRES_DSN to run the annotation backfill integration test")
	}

	ctx := context.Background()
	store, err := NewPostgreSQLStore(ctx, PostgreSQLStoreConfig{
		ConnectionString: dsn,
	}, ProvideMetrics(nil))
	require.NoError(t, err)
	t.Cleanup(func() { _ = store.Close() })

	const ns = "stacks-itest-backfill"
	// Clean any leftovers from a previous run so the test is repeatable.
	_, err = store.pool.Exec(ctx, "DELETE FROM annotations WHERE namespace = $1", ns)
	require.NoError(t, err)

	// A historical timestamp (years ago) to prove on-demand partition creation.
	historical := time.Date(2021, 6, 15, 12, 0, 0, 0, time.UTC).UnixMilli()
	end := historical + 60_000
	dashUID := "dash-1"
	panelID := int64(3)
	data := `{"alertId":7}`

	recs := []BackfillRecord{
		{
			Namespace: ns, Name: "legacy-1", Time: historical, TimeEnd: &end,
			DashboardUID: &dashUID, PanelID: &panelID,
			Text: "deploy", Tags: []string{"team:ops", "prod"},
			CreatedBy: "user-uid", CreatedAt: historical - 1000, LegacyID: 1, LegacyData: &data,
		},
		{
			Namespace: ns, Name: "legacy-2", Time: historical + 1000,
			Text: "point event", CreatedAt: historical, LegacyID: 2,
		},
	}

	inserted, err := store.BulkInsert(ctx, recs)
	require.NoError(t, err)
	require.Equal(t, int64(2), inserted)

	// Re-running is idempotent: nothing new inserted.
	inserted, err = store.BulkInsert(ctx, recs)
	require.NoError(t, err)
	require.Equal(t, int64(0), inserted)

	// Convergence count is bounded by the legacy ID space.
	migrated, err := store.CountMigratedUpTo(ctx, ns, 2)
	require.NoError(t, err)
	require.Equal(t, int64(2), migrated)
	migrated, err = store.CountMigratedUpTo(ctx, ns, 1)
	require.NoError(t, err)
	require.Equal(t, int64(1), migrated)

	// Fields are preserved faithfully on read-back.
	got, err := store.Get(ctx, ns, "legacy-1")
	require.NoError(t, err)
	require.Equal(t, historical, got.Spec.Time)
	require.NotNil(t, got.Spec.TimeEnd)
	require.Equal(t, end, *got.Spec.TimeEnd)
	require.Equal(t, int64(1), GetLegacyID(got))
	require.Equal(t, "user-uid", got.GetCreatedBy())
	require.Equal(t, historical-1000, got.CreationTimestamp.UnixMilli(), "created_at preserved from legacy")
	require.ElementsMatch(t, []string{"team:ops", "prod"}, got.Spec.Tags)
}
