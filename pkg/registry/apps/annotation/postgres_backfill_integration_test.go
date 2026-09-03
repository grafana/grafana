package annotation

import (
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/require"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana/pkg/registry/apps/annotation/migrator"
)

// week is a timestamp n ISO weeks after a fixed date years in the past, so the
// tests exercise on-demand partition creation. Distinct weeks, distinct partitions.
func week(n int) int64 {
	return time.Date(2021, 6, 15, 12, 0, 0, 0, time.UTC).AddDate(0, 0, 7*n).UnixMilli()
}

func record(ns, name string, at int64, text string) migrator.BackfillRecord {
	return migrator.BackfillRecord{
		Namespace: ns, Name: name, Time: at, Text: text,
		CreatedAt: time.UnixMilli(week(0)).UTC(),
	}
}

// rowsNamed counts every row under a name, whatever its time.
func rowsNamed(t *testing.T, store *PostgreSQLStore, ns, name string) int64 {
	t.Helper()
	var n int64
	require.NoError(t, store.pool.QueryRow(t.Context(),
		`SELECT COUNT(*) FROM annotations WHERE namespace = $1 AND name = $2`, ns, name).Scan(&n))
	return n
}

// textAt reads the row at an exact primary key.
func textAt(t *testing.T, store *PostgreSQLStore, ns, name string, at int64) string {
	t.Helper()
	var text string
	require.NoError(t, store.pool.QueryRow(t.Context(),
		`SELECT text FROM annotations WHERE namespace = $1 AND name = $2 AND time = $3`,
		ns, name, at).Scan(&text))
	return text
}

// xminOf reads the row's inserting transaction id, which Postgres changes on
// every write. It tells a no-op UPDATE apart from one that rewrote the tuple
// with identical values.
func xminOf(t *testing.T, store *PostgreSQLStore, ns, name string) int64 {
	t.Helper()
	var xmin int64
	require.NoError(t, store.pool.QueryRow(t.Context(),
		`SELECT xmin::text::bigint FROM annotations WHERE namespace = $1 AND name = $2`, ns, name).Scan(&xmin))
	return xmin
}

// insertNativeRow writes a row the way a native API write does, leaving
// legacy_migrated false. Its partition must already exist.
func insertNativeRow(t *testing.T, store *PostgreSQLStore, ns, name string, at int64, text string, legacyID int64) {
	t.Helper()
	_, err := store.pool.Exec(t.Context(),
		`INSERT INTO annotations (namespace, name, time, text, created_at, legacy_id)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		ns, name, at, text, time.UnixMilli(week(0)).UTC(), legacyID)
	require.NoError(t, err)
}

// TestIntegrationBackfill exercises the backfill write path against a real
// Postgres (GRAFANA_TEST_DB=postgres). Subtests share the store and isolate by
// namespace.
func TestIntegrationBackfill(t *testing.T) {
	store := newTestPostgresStore(t)

	t.Run("insert is idempotent and preserves every field", func(t *testing.T) {
		ctx, ns := t.Context(), "stacks-itest-insert"
		at, end := week(0), week(0)+60_000
		dashUID, panelID, data := "dash-1", int64(3), `{"alertId":7}`

		recs := []migrator.BackfillRecord{
			{
				Namespace: ns, Name: "legacy-1", Time: at, TimeEnd: &end,
				DashboardUID: &dashUID, PanelID: &panelID,
				Text: "deploy", Tags: []string{"team:ops", "prod"},
				CreatedBy: "user-uid", CreatedAt: time.UnixMilli(at - 1000).UTC(),
				LegacyID: 1, LegacyData: &data,
			},
			record(ns, "legacy-2", at+1000, "point event"),
		}

		inserted, err := store.InsertBatch(ctx, recs)
		require.NoError(t, err)
		require.Equal(t, int64(2), inserted)

		inserted, err = store.InsertBatch(ctx, recs)
		require.NoError(t, err)
		require.Zero(t, inserted, "re-inserting an unchanged record conflicts away")

		got, err := store.Get(ctx, ns, "legacy-1")
		require.NoError(t, err)
		require.Equal(t, at, got.Spec.Time)
		require.NotNil(t, got.Spec.TimeEnd)
		require.Equal(t, end, *got.Spec.TimeEnd)
		require.Equal(t, int64(1), GetLegacyID(got))
		require.Equal(t, "user-uid", got.GetCreatedBy())
		require.Equal(t, at-1000, got.CreationTimestamp.UnixMilli(), "created_at preserved from legacy")
		require.ElementsMatch(t, []string{"team:ops", "prod"}, got.Spec.Tags)
	})

	// A native write can carry a legacy_id inside the legacy autoincrement range,
	// so provenance has to key on legacy_migrated.
	t.Run("migrated count keys on provenance, not legacy id", func(t *testing.T) {
		ctx, ns := t.Context(), "stacks-itest-provenance"
		at := week(0)

		_, err := store.InsertBatch(ctx, []migrator.BackfillRecord{record(ns, "legacy-1", at, "migrated")})
		require.NoError(t, err)
		insertNativeRow(t, store, ns, "a-native", at+2000, "native", 1)

		migrated, err := store.CountMigrated(ctx, ns)
		require.NoError(t, err)
		require.Equal(t, int64(1), migrated, "native row must not inflate the migrated count")
	})

	// Time is in the primary key, so an edit that moves it moves the row between
	// weekly partitions.
	t.Run("resync moves a row across partitions in place", func(t *testing.T) {
		ctx, ns := t.Context(), "stacks-itest-move"
		at, moved := week(0), week(30)

		_, err := store.InsertBatch(ctx, []migrator.BackfillRecord{{
			Namespace: ns, Name: "legacy-1", Time: at, TimeEnd: ptr.To(at + 60_000),
			Text: "deploy", CreatedAt: time.UnixMilli(at).UTC(), LegacyID: 1,
		}})
		require.NoError(t, err)

		updated, err := store.UpsertBatch(ctx, []migrator.BackfillRecord{
			record(ns, "legacy-1", moved, "deploy-edited"),
		})
		require.NoError(t, err)
		require.Equal(t, int64(1), updated)

		got, err := store.Get(ctx, ns, "legacy-1")
		require.NoError(t, err)
		require.Equal(t, moved, got.Spec.Time, "time moved to the edited value")
		require.Equal(t, "deploy-edited", got.Spec.Text)
		require.Nil(t, got.Spec.TimeEnd, "edit cleared the region end")
		require.Equal(t, int64(1), rowsNamed(t, store, ns, "legacy-1"), "the move must not leave a copy")
	})

	// One name, one row is an invariant the primary key cannot enforce, since it
	// carries time. This pins what happens if it is ever broken.
	t.Run("a name holding two rows breaks the resync loudly", func(t *testing.T) {
		ctx, ns := t.Context(), "stacks-itest-duplicate"
		stale, current := week(0), week(0)+5_000

		_, err := store.InsertBatch(ctx, []migrator.BackfillRecord{
			record(ns, "legacy-1", stale, "stale"),
			record(ns, "legacy-1", current, "current"),
		})
		require.NoError(t, err)
		require.Equal(t, int64(2), rowsNamed(t, store, ns, "legacy-1"))

		// Reads stay stable rather than depending on which partition is scanned first.
		for range 5 {
			got, err := store.Get(ctx, ns, "legacy-1")
			require.NoError(t, err)
			require.Equal(t, stale, got.Spec.Time, "Get must be deterministic under a duplicate")
		}

		// The resync would have to collapse both onto one time. It fails instead.
		_, err = store.UpsertBatch(ctx, []migrator.BackfillRecord{
			record(ns, "legacy-1", current, "current-edited"),
		})
		require.Error(t, err, "collapsing two rows onto one primary key must not pass silently")
		var pgErr *pgconn.PgError
		require.ErrorAs(t, err, &pgErr)
		require.Equal(t, "23505", pgErr.Code, "unique_violation")
	})

	// The resync rescans a lookback window every cycle, so the rows nearest the head
	// are re-applied indefinitely on a quiet tenant. They must not cost a write.
	t.Run("re-applying an unchanged record writes nothing", func(t *testing.T) {
		ctx, ns := t.Context(), "stacks-itest-unchanged"
		at := week(0)
		rec := record(ns, "legacy-1", at, "deploy")

		_, err := store.InsertBatch(ctx, []migrator.BackfillRecord{rec})
		require.NoError(t, err)
		before := xminOf(t, store, ns, "legacy-1")

		for range 3 {
			updated, err := store.UpsertBatch(ctx, []migrator.BackfillRecord{rec})
			require.NoError(t, err)
			require.Zero(t, updated, "an identical record is not a refresh")
		}
		require.Equal(t, before, xminOf(t, store, ns, "legacy-1"), "the tuple must not be rewritten")

		// A real edit still lands, so the guard has not pinned the row.
		updated, err := store.UpsertBatch(ctx, []migrator.BackfillRecord{
			record(ns, "legacy-1", at, "deploy-edited"),
		})
		require.NoError(t, err)
		require.Equal(t, int64(1), updated)
		require.Equal(t, "deploy-edited", textAt(t, store, ns, "legacy-1", at))
	})

	// tags is a text[] compared inside a row constructor, so it needs its own case:
	// an encoding mismatch there would read as "always changed" and quietly disable
	// the guard for every tagged annotation.
	t.Run("the unchanged guard handles array columns", func(t *testing.T) {
		ctx, ns := t.Context(), "stacks-itest-unchanged-tags"
		at := week(0)
		tagged := record(ns, "legacy-1", at, "deploy")
		tagged.Tags = []string{"prod", "team:ops"}

		_, err := store.InsertBatch(ctx, []migrator.BackfillRecord{tagged})
		require.NoError(t, err)

		updated, err := store.UpsertBatch(ctx, []migrator.BackfillRecord{tagged})
		require.NoError(t, err)
		require.Zero(t, updated, "the same tags must compare equal, not distinct")

		// A tag change is a real edit and must not be swallowed.
		edited := tagged
		edited.Tags = []string{"prod", "team:sre"}
		updated, err = store.UpsertBatch(ctx, []migrator.BackfillRecord{edited})
		require.NoError(t, err)
		require.Equal(t, int64(1), updated)

		got, err := store.Get(ctx, ns, "legacy-1")
		require.NoError(t, err)
		require.ElementsMatch(t, []string{"prod", "team:sre"}, got.Spec.Tags)
	})

	// The API does not reserve the legacy-<id> prefix, so a native annotation can
	// hold one. Matching on legacy_migrated is what leaves it alone.
	t.Run("resync does not touch a row it did not write", func(t *testing.T) {
		ctx, ns := t.Context(), "stacks-itest-not-ours"
		at := week(0)

		_, err := store.InsertBatch(ctx, []migrator.BackfillRecord{record(ns, "legacy-2", at, "migrated")})
		require.NoError(t, err)
		// Same week, so the backfill's partition already covers it.
		insertNativeRow(t, store, ns, "legacy-1", at, "mine", 1)

		updated, err := store.UpsertBatch(ctx, []migrator.BackfillRecord{
			record(ns, "legacy-1", at, "from-legacy"),
		})
		require.NoError(t, err)
		require.Zero(t, updated, "nothing may be written over a row the migration does not own")
		require.Equal(t, "mine", textAt(t, store, ns, "legacy-1", at))
	})

	// A record the backfill has not copied is left for it, so a legacy id is never
	// written by two paths at the two times each happened to read it at.
	t.Run("resync never writes a row the backfill has not copied", func(t *testing.T) {
		ctx, ns := t.Context(), "stacks-itest-update-only"
		at := week(0)

		_, err := store.InsertBatch(ctx, []migrator.BackfillRecord{record(ns, "legacy-1", at, "backfilled")})
		require.NoError(t, err)

		updated, err := store.UpsertBatch(ctx, []migrator.BackfillRecord{
			record(ns, "legacy-1", at, "backfilled-edited"),
			record(ns, "legacy-2", at+3000, "never backfilled"),
		})
		require.NoError(t, err)
		require.Equal(t, int64(1), updated, "only the row already in the store is refreshed")
		require.Equal(t, "backfilled-edited", textAt(t, store, ns, "legacy-1", at))
		require.Zero(t, rowsNamed(t, store, ns, "legacy-2"), "the backfill is the only writer of new rows")
	})

	// The tombstone survives, and still counts as copied so the backfill does not
	// treat the annotation as missing.
	t.Run("resync preserves a destination tombstone", func(t *testing.T) {
		ctx, ns := t.Context(), "stacks-itest-tombstone"
		at := week(0)

		_, err := store.InsertBatch(ctx, []migrator.BackfillRecord{record(ns, "legacy-1", at, "backfilled")})
		require.NoError(t, err)
		require.NoError(t, store.Delete(ctx, ns, "legacy-1"))

		updated, err := store.UpsertBatch(ctx, []migrator.BackfillRecord{
			record(ns, "legacy-1", at, "edited after deletion"),
		})
		require.NoError(t, err)
		require.Equal(t, int64(1), updated)

		var (
			deletedAt *time.Time
			text      string
		)
		require.NoError(t, store.pool.QueryRow(ctx,
			`SELECT deleted_at, text FROM annotations WHERE namespace = $1 AND name = $2`, ns, "legacy-1",
		).Scan(&deletedAt, &text))
		require.NotNil(t, deletedAt, "the resync must not resurrect a deleted annotation")
		require.Equal(t, "edited after deletion", text, "but the edited fields still land")

		migrated, err := store.CountMigrated(ctx, ns)
		require.NoError(t, err)
		require.Equal(t, int64(1), migrated, "a copy the user deleted has still been copied")
	})
}
