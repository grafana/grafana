package migrator

import (
	"context"
	"fmt"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"
)

// fakeReader serves a fixed set of legacy annotations with keyset pagination,
// mirroring MySQLReader's id-ascending
type fakeReader struct {
	rows      []LegacyAnnotation
	readCalls int
	// onBatch, if set, is invoked after each ReadBatch returns (used to inject
	// cancellation mid-run).
	onBatch func()
}

func (f *fakeReader) CountUserAnnotations(_ context.Context, _ int64) (int64, error) {
	return int64(len(f.rows)), nil
}

func (f *fakeReader) ReadBatch(_ context.Context, _ int64, afterID int64, limit int) ([]LegacyAnnotation, error) {
	f.readCalls++
	var batch []LegacyAnnotation
	for _, r := range f.rows {
		if r.ID > afterID {
			batch = append(batch, r)
			if len(batch) == limit {
				break
			}
		}
	}
	if f.onBatch != nil {
		f.onBatch()
	}
	return batch, nil
}

func (f *fakeReader) ReadChangedBatch(_ context.Context, _ int64, sinceUpdated, afterID int64, limit int) ([]LegacyAnnotation, error) {
	f.readCalls++
	var matched []LegacyAnnotation
	for _, r := range f.rows {
		if r.Updated > sinceUpdated || (r.Updated == sinceUpdated && r.ID > afterID) {
			matched = append(matched, r)
		}
	}
	// Mirror the SQL ORDER BY (updated, id).
	sort.Slice(matched, func(i, j int) bool {
		if matched[i].Updated != matched[j].Updated {
			return matched[i].Updated < matched[j].Updated
		}
		return matched[i].ID < matched[j].ID
	})
	if len(matched) > limit {
		matched = matched[:limit]
	}
	if f.onBatch != nil {
		f.onBatch()
	}
	return matched, nil
}

// storedRow is a persisted annotation plus its legacy_migrated provenance flag.
// Rows written through the backfill paths (InsertBatch/UpsertBatch) are migrated;
// a proxied/native write injected directly into rows is not.
type storedRow struct {
	rec      BackfillRecord
	migrated bool
}

// fakeWriter mimics InsertBatch against the (namespace, name, time) primary key
// with ON CONFLICT DO NOTHING; the convergence count matches on the
// legacy_migrated flag, as the real store does.
type fakeWriter struct {
	rows         map[string]storedRow
	insertCalls  int
	insertErr    error
	errOnCallNum int
}

func newFakeWriter() *fakeWriter {
	return &fakeWriter{rows: map[string]storedRow{}}
}

func pk(r BackfillRecord) string {
	return fmt.Sprintf("%s|%s|%d", r.Namespace, r.Name, r.Time)
}

func (w *fakeWriter) InsertBatch(_ context.Context, recs []BackfillRecord) (int64, error) {
	w.insertCalls++
	if w.insertErr != nil && w.insertCalls == w.errOnCallNum {
		return 0, w.insertErr
	}
	var inserted int64
	for _, r := range recs {
		key := pk(r)
		if _, exists := w.rows[key]; exists {
			continue // ON CONFLICT DO NOTHING
		}
		w.rows[key] = storedRow{rec: r, migrated: true}
		inserted++
	}
	return inserted, nil
}

func (w *fakeWriter) UpsertBatch(_ context.Context, recs []BackfillRecord) (int64, error) {
	w.insertCalls++
	if w.insertErr != nil && w.insertCalls == w.errOnCallNum {
		return 0, w.insertErr
	}
	// Delete any existing rows for these names (across any time), then insert
	// the current version — mirroring the store's delete-by-name + insert.
	for _, r := range recs {
		for key, existing := range w.rows {
			if existing.rec.Namespace == r.Namespace && existing.rec.Name == r.Name {
				delete(w.rows, key)
			}
		}
	}
	var applied int64
	for _, r := range recs {
		w.rows[pk(r)] = storedRow{rec: r, migrated: true}
		applied++
	}
	return applied, nil
}

func (w *fakeWriter) CountMigrated(_ context.Context, namespace string) (int64, error) {
	var count int64
	for _, sr := range w.rows {
		if sr.rec.Namespace == namespace && sr.migrated {
			count++
		}
	}
	return count, nil
}

func makeRows(n int) []LegacyAnnotation {
	rows := make([]LegacyAnnotation, n)
	for i := 0; i < n; i++ {
		rows[i] = LegacyAnnotation{ID: int64(i + 1), Epoch: int64(1000 + i), Text: fmt.Sprintf("a%d", i+1)}
	}
	return rows
}

func req(ns string, batchSize int) Request {
	return Request{OrgID: 1, Namespace: ns, BatchSize: batchSize}
}

func TestMigrate_FullPass(t *testing.T) {
	r := &fakeReader{rows: makeRows(5)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	res, err := m.Migrate(context.Background(), req("stacks-1", 2))
	require.NoError(t, err)
	require.Equal(t, int64(5), res.Scanned)
	require.Equal(t, int64(5), res.Inserted)
	require.Equal(t, int64(0), res.Skipped)
	require.Len(t, w.rows, 5)
}

func TestMigrate_IdempotentRerun(t *testing.T) {
	r := &fakeReader{rows: makeRows(5)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	_, err := m.Migrate(context.Background(), req("stacks-1", 2))
	require.NoError(t, err)

	res, err := m.Migrate(context.Background(), req("stacks-1", 2))
	require.NoError(t, err)
	require.Equal(t, int64(5), res.Scanned)
	require.Equal(t, int64(0), res.Inserted, "re-run must insert nothing")
	require.Equal(t, int64(5), res.Skipped)
	require.Len(t, w.rows, 5, "no duplicates created")
}

func TestMigrate_PagingExactMultiple(t *testing.T) {
	// 4 rows, batch size 2: the second full page is followed by an empty page.
	r := &fakeReader{rows: makeRows(4)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	res, err := m.Migrate(context.Background(), req("stacks-1", 2))
	require.NoError(t, err)
	require.Equal(t, int64(4), res.Inserted)
	require.Len(t, w.rows, 4)
}

func TestMigrate_DryRun(t *testing.T) {
	r := &fakeReader{rows: makeRows(3)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	res, err := m.Migrate(context.Background(), Request{OrgID: 1, Namespace: "stacks-1", BatchSize: 2, DryRun: true})
	require.NoError(t, err)
	require.Equal(t, int64(3), res.Scanned)
	require.Equal(t, int64(0), res.Inserted)
	require.Empty(t, w.rows, "dry run must not write")
	require.Zero(t, w.insertCalls)
}

func TestMigrate_CancelledUpFront(t *testing.T) {
	r := &fakeReader{rows: makeRows(5)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	res, err := m.Migrate(ctx, req("stacks-1", 2))
	require.ErrorIs(t, err, context.Canceled)
	require.Zero(t, res.Scanned)
	require.Zero(t, r.readCalls, "should bail before reading")
}

func TestMigrate_CancelledMidRun(t *testing.T) {
	r := &fakeReader{rows: makeRows(10)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	ctx, cancel := context.WithCancel(context.Background())
	// Cancel right after the first batch is read+written so the loop exits on
	// the next iteration with a partial, persisted result.
	r.onBatch = func() {
		if r.readCalls == 1 {
			cancel()
		}
	}

	res, err := m.Migrate(ctx, req("stacks-1", 2))
	require.ErrorIs(t, err, context.Canceled)
	require.Equal(t, int64(2), res.Scanned, "first batch persisted before cancel")
	require.Equal(t, int64(2), res.Inserted)
	require.Len(t, w.rows, 2)

	// Resuming completes the rest idempotently.
	res2, err := m.Migrate(context.Background(), req("stacks-1", 2))
	require.NoError(t, err)
	require.Equal(t, int64(10), res2.Scanned)
	require.Equal(t, int64(8), res2.Inserted)
	require.Len(t, w.rows, 10)
}

func TestMigrate_WriteErrorReturnsPartial(t *testing.T) {
	r := &fakeReader{rows: makeRows(6)}
	w := newFakeWriter()
	w.insertErr = fmt.Errorf("boom")
	w.errOnCallNum = 2 // first batch succeeds, second fails
	m := ProvideMigrator(r, w, nil)

	res, err := m.Migrate(context.Background(), req("stacks-1", 2))
	require.ErrorContains(t, err, "boom")
	require.Equal(t, int64(2), res.Inserted, "first batch counted before failure")
}

func TestVerifyCounts(t *testing.T) {
	r := &fakeReader{rows: makeRows(5)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	// Before migrating: 5 legacy, 0 migrated.
	legacy, migrated, err := m.VerifyCounts(context.Background(), req("stacks-1", 0))
	require.NoError(t, err)
	require.Equal(t, int64(5), legacy)
	require.Equal(t, int64(0), migrated)

	_, err = m.Migrate(context.Background(), req("stacks-1", 2))
	require.NoError(t, err)

	// After migrating: converged.
	legacy, migrated, err = m.VerifyCounts(context.Background(), req("stacks-1", 0))
	require.NoError(t, err)
	require.Equal(t, int64(5), legacy)
	require.Equal(t, int64(5), migrated)
}

func TestVerifyCounts_IgnoresNativeSnowflakeRows(t *testing.T) {
	r := &fakeReader{rows: makeRows(5)} // legacy IDs 1..5
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	_, err := m.Migrate(context.Background(), req("stacks-1", 10))
	require.NoError(t, err)

	// Simulate a proxied/native write (legacy_migrated = false) whose masked
	// snowflake legacy ID falls *inside* the legacy autoincrement range (here 3,
	// within 1..5). A value-range convergence check would miscount it as
	// migrated; provenance keys on legacy_migrated, which native rows never set.
	native := BackfillRecord{Namespace: "stacks-1", Name: "a-native", Time: 9999, LegacyID: 3}
	w.rows[pk(native)] = storedRow{rec: native, migrated: false}

	legacy, migrated, err := m.VerifyCounts(context.Background(), req("stacks-1", 0))
	require.NoError(t, err)
	require.Equal(t, int64(5), legacy)
	require.Equal(t, int64(5), migrated, "native row with a colliding legacy ID must not inflate the migrated count")
}

func TestSyncUpdates_AppliesEditAndMovesTimeWithoutDuplicating(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{
		{ID: 1, Epoch: 1000, Updated: 10, Text: "a1"},
		{ID: 2, Epoch: 2000, Updated: 20, Text: "a2"},
	}}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	// Initial backfill lands both rows.
	_, err := m.Migrate(context.Background(), req("stacks-1", 10))
	require.NoError(t, err)
	require.Len(t, w.rows, 2)

	// First sync from the zero cursor covers both changed rows and advances the
	// cursor to the last (updated, id).
	res, cursor, err := m.SyncUpdates(context.Background(), req("stacks-1", 10), UpdateCursor{})
	require.NoError(t, err)
	require.Equal(t, int64(2), res.Scanned)
	require.Equal(t, UpdateCursor{Updated: 20, ID: 2}, cursor)

	// Edit annotation 1: change text, MOVE its time, and bump `updated`.
	r.rows[0] = LegacyAnnotation{ID: 1, Epoch: 1500, Updated: 30, Text: "a1-edited"}

	// Resuming from the prior cursor sees only the edited row.
	res, cursor, err = m.SyncUpdates(context.Background(), req("stacks-1", 10), cursor)
	require.NoError(t, err)
	require.Equal(t, int64(1), res.Scanned)
	require.Equal(t, int64(1), res.Inserted)
	require.Equal(t, UpdateCursor{Updated: 30, ID: 1}, cursor)

	// No duplicate: still exactly two rows, legacy-1 sits at its new time with
	// the new text, and the old-time row is gone.
	require.Len(t, w.rows, 2)
	got, ok := w.rows[pk(BackfillRecord{Namespace: "stacks-1", Name: "legacy-1", Time: 1500})]
	require.True(t, ok, "legacy-1 should exist at the new time")
	require.Equal(t, "a1-edited", got.rec.Text)
	_, oldExists := w.rows[pk(BackfillRecord{Namespace: "stacks-1", Name: "legacy-1", Time: 1000})]
	require.False(t, oldExists, "old-time row must be removed")
}

func TestSyncUpdates_DryRunWritesNothing(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{{ID: 1, Epoch: 1000, Updated: 10}}}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	res, cursor, err := m.SyncUpdates(context.Background(), Request{OrgID: 1, Namespace: "stacks-1", BatchSize: 10, DryRun: true}, UpdateCursor{})
	require.NoError(t, err)
	require.Equal(t, int64(1), res.Scanned)
	require.Equal(t, int64(0), res.Inserted)
	require.Empty(t, w.rows, "dry run must not write")
	require.Equal(t, UpdateCursor{Updated: 10, ID: 1}, cursor, "cursor still advances so a dry run reports the full range")
}

func TestSyncUpdates_PagesAcrossBatches(t *testing.T) {
	rows := make([]LegacyAnnotation, 5)
	for i := range rows {
		rows[i] = LegacyAnnotation{ID: int64(i + 1), Epoch: int64(1000 + i), Updated: int64(10 + i)}
	}
	r := &fakeReader{rows: rows}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	res, cursor, err := m.SyncUpdates(context.Background(), req("stacks-1", 2), UpdateCursor{})
	require.NoError(t, err)
	require.Equal(t, int64(5), res.Scanned)
	require.Equal(t, int64(5), res.Inserted)
	require.Equal(t, UpdateCursor{Updated: 14, ID: 5}, cursor)
	require.Len(t, w.rows, 5)
}

func TestMigrate_EmptyTenant(t *testing.T) {
	r := &fakeReader{}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	res, err := m.Migrate(context.Background(), req("stacks-1", 100))
	require.NoError(t, err)
	require.Zero(t, res.Scanned)
	require.Zero(t, res.Inserted)
}
