package annotation

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/registry/apps/annotation/migrator"
)

// TestIntegrationBackfill exercises the backfill write path against a real
// Postgres. It runs in the Postgres integration job (GRAFANA_TEST_DB=postgres)
// via newTestPostgresStore, which provisions an isolated database and runs the
// store's migrations on construction.
func TestIntegrationBackfill(t *testing.T) {
	store := newTestPostgresStore(t)
	ctx := t.Context()

	const ns = "stacks-itest-backfill"

	// A historical timestamp (years ago) to prove on-demand partition creation.
	historical := time.Date(2021, 6, 15, 12, 0, 0, 0, time.UTC).UnixMilli()
	end := historical + 60_000
	dashUID := "dash-1"
	panelID := int64(3)
	data := `{"alertId":7}`

	recs := []migrator.BackfillRecord{
		{
			Namespace: ns, Name: "legacy-1", Time: historical, TimeEnd: &end,
			DashboardUID: &dashUID, PanelID: &panelID,
			Text: "deploy", Tags: []string{"team:ops", "prod"},
			CreatedBy: "user-uid", CreatedAt: time.UnixMilli(historical - 1000).UTC(), LegacyID: 1, LegacyData: &data,
		},
		{
			Namespace: ns, Name: "legacy-2", Time: historical + 1000,
			Text: "point event", CreatedAt: time.UnixMilli(historical).UTC(), LegacyID: 2,
		},
	}

	inserted, err := store.InsertBatch(ctx, recs)
	require.NoError(t, err)
	require.Equal(t, int64(2), inserted)

	// Re-running is idempotent: nothing new inserted.
	inserted, err = store.InsertBatch(ctx, recs)
	require.NoError(t, err)
	require.Equal(t, int64(0), inserted)

	// The convergence count identifies migrated rows by the legacy_migrated
	// provenance flag, not by legacy_id value.
	migrated, err := store.CountMigrated(ctx, ns)
	require.NoError(t, err)
	require.Equal(t, int64(2), migrated)

	// Simulate a proxied/native write (not through the backfill path, so
	// legacy_migrated stays false) whose masked snowflake legacy_id collides
	// with the legacy autoincrement range. It must not be counted as migrated.
	_, err = store.pool.Exec(ctx,
		`INSERT INTO annotations (namespace, name, time, text, created_at, legacy_id)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		ns, "a-native", historical+2000, "native", time.UnixMilli(historical).UTC(), int64(1),
	)
	require.NoError(t, err)
	migrated, err = store.CountMigrated(ctx, ns)
	require.NoError(t, err)
	require.Equal(t, int64(2), migrated, "native row must not inflate the migrated count")

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

	// UpsertBatch reconciles an edit that moves the annotation's time into a
	// different (here, new) weekly partition without leaving a duplicate behind.
	movedTime := time.Date(2022, 1, 10, 12, 0, 0, 0, time.UTC).UnixMilli()
	_, err = store.UpsertBatch(ctx, []migrator.BackfillRecord{{
		Namespace: ns, Name: "legacy-1", Time: movedTime,
		Text: "deploy-edited", CreatedAt: time.UnixMilli(historical - 1000).UTC(), LegacyID: 1,
	}})
	require.NoError(t, err)

	got, err = store.Get(ctx, ns, "legacy-1")
	require.NoError(t, err)
	require.Equal(t, movedTime, got.Spec.Time, "time moved to the edited value")
	require.Equal(t, "deploy-edited", got.Spec.Text)
	require.Nil(t, got.Spec.TimeEnd, "edit cleared the region end")

	// Still exactly the two migrated rows — the old-time row was removed, not
	// duplicated — and the native row is still excluded.
	migrated, err = store.CountMigrated(ctx, ns)
	require.NoError(t, err)
	require.Equal(t, int64(2), migrated, "upsert must not create a duplicate")
}
