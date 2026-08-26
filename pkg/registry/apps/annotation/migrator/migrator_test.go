package migrator

import (
	"context"
	"fmt"
	"sort"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

// fakeReader serves a fixed set of legacy annotations with keyset pagination,
// mirroring MySQLReader.
type fakeReader struct {
	rows      []LegacyAnnotation
	readCalls int
	// onBatch runs after each read, to inject a cancellation or a legacy write
	// mid-pass.
	onBatch         func()
	latestChangeErr error
}

func (f *fakeReader) Totals(_ context.Context, _ int64) (LegacyTotals, error) {
	totals := LegacyTotals{Count: int64(len(f.rows))}
	for _, r := range f.rows {
		if r.ID > totals.MaxID {
			totals.MaxID = r.ID
		}
	}
	return totals, nil
}

func (f *fakeReader) LatestChange(_ context.Context, _ int64) (UpdateCursor, error) {
	if f.latestChangeErr != nil {
		return UpdateCursor{}, f.latestChangeErr
	}
	var head UpdateCursor
	for _, r := range f.rows {
		if c := (UpdateCursor{Updated: r.Updated, ID: r.ID}); head.Before(c) {
			head = c
		}
	}
	return head, nil
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

// storedRow is a persisted annotation plus the two destination-owned columns the
// backfill paths must never clobber. Tests set migrated=false to stand in for a
// native write, which never goes through the backfill.
type storedRow struct {
	rec      BackfillRecord
	migrated bool
	deleted  bool
}

// fakeWriter mimics the Postgres store, keyed on (namespace, name, time) so it
// can hold two rows under one name exactly as the real one can.
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

// migratedKeysByName returns every migrated row under a (namespace, name),
// earliest first. The resync only ever matches rows it wrote.
func (w *fakeWriter) migratedKeysByName(namespace, name string) []string {
	var keys []string
	for key, existing := range w.rows {
		if existing.migrated && existing.rec.Namespace == namespace && existing.rec.Name == name {
			keys = append(keys, key)
		}
	}
	sort.Slice(keys, func(i, j int) bool { return w.rows[keys[i]].rec.Time < w.rows[keys[j]].rec.Time })
	return keys
}

func (w *fakeWriter) findByName(namespace, name string) (string, bool) {
	keys := w.migratedKeysByName(namespace, name)
	if len(keys) == 0 {
		return "", false
	}
	return keys[0], true
}

// countByName counts every row under a name, migrated or not — the duplicate check.
func (w *fakeWriter) countByName(namespace, name string) int {
	var n int
	for _, existing := range w.rows {
		if existing.rec.Namespace == namespace && existing.rec.Name == name {
			n++
		}
	}
	return n
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

// UpsertBatch matches by name with no time predicate, so it moves the row when
// the record's time changed, and it only ever updates.
func (w *fakeWriter) UpsertBatch(_ context.Context, recs []BackfillRecord) (int64, error) {
	w.insertCalls++
	if w.insertErr != nil && w.insertCalls == w.errOnCallNum {
		return 0, w.insertErr
	}

	var updated int64
	for _, r := range recs {
		keys := w.migratedKeysByName(r.Namespace, r.Name)
		if len(keys) == 0 {
			continue
		}
		if len(keys) > 1 {
			// The real store would set every copy to the same time, breaking the PK.
			return 0, fmt.Errorf("duplicate key value violates unique constraint")
		}
		existing := w.rows[keys[0]]
		delete(w.rows, keys[0])
		w.rows[pk(r)] = storedRow{rec: r, migrated: existing.migrated, deleted: existing.deleted}
		updated++
	}
	return updated, nil
}

// CountMigrated counts tombstoned rows too: a copy the user deleted is still a copy.
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

// rowAt is the key a legacy id should occupy at a given time.
func rowAt(ns string, id, at int64) string {
	return pk(BackfillRecord{Namespace: ns, Name: legacyName(id), Time: at})
}

func TestMigrate_FullPass(t *testing.T) {
	r := &fakeReader{rows: makeRows(5)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	res, cursors, err := m.Migrate(context.Background(), req("stacks-1", 2), Cursors{})
	require.NoError(t, err)
	require.Equal(t, int64(5), res.Scanned)
	require.Equal(t, int64(5), res.Inserted)
	require.Equal(t, int64(0), res.Skipped)
	require.Equal(t, int64(5), cursors.Backfill, "the cursor tracks the last id copied")
	require.Len(t, w.rows, 5)
}

func TestMigrate_ResumesAbovePersistedID(t *testing.T) {
	r := &fakeReader{rows: makeRows(5)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	_, cursors, err := m.Migrate(context.Background(), req("stacks-1", 2), Cursors{})
	require.NoError(t, err)

	res, cursors, err := m.Migrate(context.Background(), req("stacks-1", 2), cursors)
	require.NoError(t, err)
	require.Zero(t, res.Scanned, "a re-run must not re-read rows it has already copied")
	require.Zero(t, res.Inserted)
	require.Equal(t, int64(5), cursors.Backfill)
	require.Len(t, w.rows, 5)

	// New legacy rows are picked up from where the cursor left off.
	r.rows = append(r.rows, LegacyAnnotation{ID: 6, Epoch: 6000, Text: "a6"})
	res, cursors, err = m.Migrate(context.Background(), req("stacks-1", 2), cursors)
	require.NoError(t, err)
	require.Equal(t, int64(1), res.Scanned)
	require.Equal(t, int64(1), res.Inserted)
	require.Equal(t, int64(6), cursors.Backfill)
}

// A moved row re-reads as a primary key the store has never seen, so ON CONFLICT
// cannot recognise it. Only never revisiting the id avoids the duplicate, and
// only SyncUpdates can carry the move across.
func TestMigrate_PersistedIDPreventsDuplicateAfterTimeEdit(t *testing.T) {
	rows := []LegacyAnnotation{{ID: 1, Epoch: 1000, Updated: 10, Text: "a1"}}
	r := &fakeReader{rows: rows}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	_, cursors, err := m.Migrate(context.Background(), req("stacks-1", 10), Cursors{})
	require.NoError(t, err)

	// The user drags the annotation to a new time.
	r.rows[0] = LegacyAnnotation{ID: 1, Epoch: 1500, Updated: 30, Text: "a1-moved"}

	_, cursors, err = m.Migrate(context.Background(), req("stacks-1", 10), cursors)
	require.NoError(t, err)
	require.Equal(t, 1, w.countByName("stacks-1", "legacy-1"), "the backfill must not copy a moved row again")

	_, cursors, err = m.SyncUpdates(context.Background(), req("stacks-1", 10), cursors)
	require.NoError(t, err)
	require.Equal(t, Cursors{Backfill: 1, Updates: UpdateCursor{Updated: 30, ID: 1}}, cursors,
		"each pass advances only its own cursor")
	require.Equal(t, 1, w.countByName("stacks-1", "legacy-1"))
	require.Equal(t, "a1-moved", w.rows[rowAt("stacks-1", 1, 1500)].rec.Text)

	// A rescan alone is harmless once the resync has caught up: it re-reads the row
	// at the time the destination already holds, and conflicts away.
	_, _, err = m.Migrate(context.Background(), req("stacks-1", 10), Cursors{})
	require.NoError(t, err)
	require.Equal(t, 1, w.countByName("stacks-1", "legacy-1"))

	// A duplicate needs both: an unapplied edit, and a rescan reading the row at
	// its new time meanwhile.
	r.rows[0] = LegacyAnnotation{ID: 1, Epoch: 2000, Updated: 40, Text: "a1-moved-again"}
	_, _, err = m.Migrate(context.Background(), req("stacks-1", 10), Cursors{})
	require.NoError(t, err)
	require.Equal(t, 2, w.countByName("stacks-1", "legacy-1"), "a rescan racing an unapplied edit still duplicates")
}

func TestMigrate_PagingExactMultiple(t *testing.T) {
	// 4 rows, batch size 2: the second full page is followed by an empty page.
	r := &fakeReader{rows: makeRows(4)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	res, cursors, err := m.Migrate(context.Background(), req("stacks-1", 2), Cursors{})
	require.NoError(t, err)
	require.Equal(t, int64(4), res.Inserted)
	require.Equal(t, int64(4), cursors.Backfill)
	require.Len(t, w.rows, 4)
}

// A cursor reset re-reads everything; unchanged rows conflict away.
func TestMigrate_RescanFromZeroSkipsRowsAlreadyCopied(t *testing.T) {
	r := &fakeReader{rows: makeRows(5)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	_, _, err := m.Migrate(context.Background(), req("stacks-1", 2), Cursors{})
	require.NoError(t, err)

	res, _, err := m.Migrate(context.Background(), req("stacks-1", 2), Cursors{})
	require.NoError(t, err)
	require.Equal(t, int64(5), res.Scanned)
	require.Zero(t, res.Inserted, "re-run must insert nothing")
	require.Equal(t, int64(5), res.Skipped)
	require.Len(t, w.rows, 5, "no duplicates created")
}

func TestMigrate_DryRun(t *testing.T) {
	r := &fakeReader{rows: makeRows(3)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	res, cursors, err := m.Migrate(context.Background(), Request{OrgID: 1, Namespace: "stacks-1", BatchSize: 2, DryRun: true}, Cursors{})
	require.NoError(t, err)
	require.Equal(t, int64(3), res.Scanned)
	require.Zero(t, res.Inserted)
	require.Equal(t, int64(3), cursors.Backfill, "reports the range scanned; a dry run must not persist it")
	require.Empty(t, w.rows, "dry run must not write")
	require.Zero(t, w.insertCalls)
}

func TestMigrate_CancelledUpFront(t *testing.T) {
	r := &fakeReader{rows: makeRows(5)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	res, cursors, err := m.Migrate(ctx, req("stacks-1", 2), Cursors{Backfill: 3})
	require.ErrorIs(t, err, context.Canceled)
	require.Zero(t, res.Scanned)
	require.Equal(t, int64(3), cursors.Backfill, "the cursor is handed back untouched")
	require.Zero(t, r.readCalls, "should bail before reading")
}

func TestMigrate_CancelledMidRun(t *testing.T) {
	r := &fakeReader{rows: makeRows(10)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	ctx, cancel := context.WithCancel(context.Background())
	// Cancel after the first batch commits, so the loop exits with partial progress.
	r.onBatch = func() {
		if r.readCalls == 1 {
			cancel()
		}
	}

	res, cursors, err := m.Migrate(ctx, req("stacks-1", 2), Cursors{})
	require.ErrorIs(t, err, context.Canceled)
	require.Equal(t, int64(2), res.Scanned, "first batch persisted before cancel")
	require.Equal(t, int64(2), res.Inserted)
	require.Equal(t, int64(2), cursors.Backfill, "the cursor covers the batches that committed")
	require.Len(t, w.rows, 2)

	res2, cursors, err := m.Migrate(context.Background(), req("stacks-1", 2), cursors)
	require.NoError(t, err)
	require.Equal(t, int64(8), res2.Scanned, "resumes above the last committed id")
	require.Equal(t, int64(8), res2.Inserted)
	require.Equal(t, int64(10), cursors.Backfill)
	require.Len(t, w.rows, 10)
}

func TestMigrate_WriteErrorReturnsPartial(t *testing.T) {
	r := &fakeReader{rows: makeRows(6)}
	w := newFakeWriter()
	w.insertErr = fmt.Errorf("boom")
	w.errOnCallNum = 2 // first batch succeeds, second fails
	m := ProvideMigrator(r, w, nil)

	res, cursors, err := m.Migrate(context.Background(), req("stacks-1", 2), Cursors{})
	require.ErrorContains(t, err, "boom")
	require.Equal(t, int64(2), res.Inserted, "first batch counted before failure")
	require.Equal(t, int64(2), cursors.Backfill, "the failed batch must not advance the cursor past itself")
}

func TestMigrate_EmptyTenant(t *testing.T) {
	r := &fakeReader{}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	res, cursors, err := m.Migrate(context.Background(), req("stacks-1", 100), Cursors{})
	require.NoError(t, err)
	require.Zero(t, res.Scanned)
	require.Zero(t, res.Inserted)
	require.Zero(t, cursors.Backfill)
}

// The update cursor must be seeded from a head read *before* the first backfill.
// A row edited mid-run gets an `updated` past a head read afterwards, so
// SyncUpdates would never replay that edit.
func TestStatus_HeadSeedsCursorThatReplaysEditsRacingTheBackfill(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{
		{ID: 1, Epoch: 1000, Updated: 10, Text: "a1"},
		{ID: 2, Epoch: 2000, Updated: 20, Text: "a2"},
		{ID: 3, Epoch: 3000, Updated: 30, Text: "a3"},
		{ID: 4, Epoch: 4000, Updated: 40, Text: "a4"},
	}}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	st, err := m.Status(context.Background(), req("stacks-1", 0), Cursors{})
	require.NoError(t, err)
	seed := Cursors{Updates: st.UpdatesHead}
	require.Equal(t, UpdateCursor{Updated: 40, ID: 4}, seed.Updates)

	// Once ids 1-2 are copied, someone edits id 1, bumping it past the head.
	r.onBatch = func() {
		if r.readCalls == 1 {
			r.rows[0] = LegacyAnnotation{ID: 1, Epoch: 1000, Updated: 50, Text: "a1-edited"}
		}
	}

	_, backfilled, err := m.Migrate(context.Background(), req("stacks-1", 2), seed)
	require.NoError(t, err)

	// Resyncing from the seed replays the edit the backfill raced with.
	res, _, err := m.SyncUpdates(context.Background(), req("stacks-1", 10), backfilled)
	require.NoError(t, err)
	require.Equal(t, int64(1), res.Scanned)
	require.Equal(t, "a1-edited", w.rows[rowAt("stacks-1", 1, 1000)].rec.Text)

	after, err := m.Status(context.Background(), req("stacks-1", 0), Cursors{})
	require.NoError(t, err)
	require.True(t, seed.Updates.Before(after.UpdatesHead), "the racing edit moved the head past the seed")
}

func TestStatus_HeadIsZeroForEmptyTenant(t *testing.T) {
	m := ProvideMigrator(&fakeReader{}, newFakeWriter(), nil)

	st, err := m.Status(context.Background(), req("stacks-1", 0), Cursors{})
	require.NoError(t, err)
	require.Equal(t, UpdateCursor{}, st.UpdatesHead)
	require.False(t, st.BackfillPending, "nothing to copy on an empty tenant")
	require.False(t, st.Behind(Cursors{}), "nothing to sync on an empty tenant")
}

func TestStatus_BackfillPendingUntilDrained(t *testing.T) {
	r := &fakeReader{rows: makeRows(5)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	st, err := m.Status(context.Background(), req("stacks-1", 0), Cursors{})
	require.NoError(t, err)
	require.Equal(t, int64(5), st.LegacyCount)
	require.Zero(t, st.MigratedCount)
	require.True(t, st.BackfillPending)

	// Half-way through, the cursor still trails the highest legacy id.
	st, err = m.Status(context.Background(), req("stacks-1", 0), Cursors{Backfill: 3})
	require.NoError(t, err)
	require.True(t, st.BackfillPending)

	_, cursors, err := m.Migrate(context.Background(), req("stacks-1", 2), Cursors{})
	require.NoError(t, err)

	st, err = m.Status(context.Background(), req("stacks-1", 0), cursors)
	require.NoError(t, err)
	require.Equal(t, int64(5), st.LegacyCount)
	require.Equal(t, int64(5), st.MigratedCount)
	require.False(t, st.BackfillPending)

	// A new legacy annotation reopens it.
	r.rows = append(r.rows, LegacyAnnotation{ID: 6, Epoch: 6000})
	st, err = m.Status(context.Background(), req("stacks-1", 0), cursors)
	require.NoError(t, err)
	require.True(t, st.BackfillPending)
}

// The gate reads the id keyset the backfill walks, not a count comparison, because
// counts drift for reasons unrelated to progress: duplicates inflate the
// destination, and the retention TTL dropping a partition deflates it.
func TestStatus_BackfillPendingIgnoresDestinationCountDrift(t *testing.T) {
	r := &fakeReader{rows: makeRows(5)}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	// Copy ids 1-3 only, so there is genuinely work left.
	_, cursors, err := m.Migrate(context.Background(), req("stacks-1", 3), Cursors{Backfill: 0})
	require.NoError(t, err)
	cursors.Backfill = 3

	for _, at := range []int64{7000, 7001, 7002} {
		dup := BackfillRecord{Namespace: "stacks-1", Name: "legacy-1", Time: at}
		w.rows[pk(dup)] = storedRow{rec: dup, migrated: true}
	}

	st, err := m.Status(context.Background(), req("stacks-1", 0), cursors)
	require.NoError(t, err)
	require.Greater(t, st.MigratedCount, st.LegacyCount, "duplicates put the destination ahead of legacy")
	require.True(t, st.BackfillPending, "ids 4 and 5 are still uncopied, whatever the counts say")

	// The other direction: retention drops everything the backfill wrote.
	w.rows = map[string]storedRow{}
	cursors.Backfill = 5

	st, err = m.Status(context.Background(), req("stacks-1", 0), cursors)
	require.NoError(t, err)
	require.Zero(t, st.MigratedCount)
	require.False(t, st.BackfillPending, "expired rows must not re-trigger a backfill that would resurrect them")
}

// An edit creates no new id, so the backfill cursor cannot see it. Only the
// `updated` timeline can.
func TestStatus_HeadMovesAfterEditOnConvergedTenant(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{
		{ID: 1, Epoch: 1000, Updated: 10},
		{ID: 2, Epoch: 2000, Updated: 20},
	}}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	seeded, err := m.Status(context.Background(), req("stacks-1", 0), Cursors{})
	require.NoError(t, err)

	_, cursors, err := m.Migrate(context.Background(), req("stacks-1", 10), Cursors{Updates: seeded.UpdatesHead})
	require.NoError(t, err)

	_, cursors, err = m.SyncUpdates(context.Background(), req("stacks-1", 10), cursors)
	require.NoError(t, err)

	st, err := m.Status(context.Background(), req("stacks-1", 0), cursors)
	require.NoError(t, err)
	require.False(t, st.BackfillPending, "every legacy id has been copied")
	require.False(t, st.Behind(cursors), "nothing changed since the cursor")

	r.rows[0] = LegacyAnnotation{ID: 1, Epoch: 1500, Updated: 30}

	st, err = m.Status(context.Background(), req("stacks-1", 0), cursors)
	require.NoError(t, err)
	require.False(t, st.BackfillPending, "an edit creates no new id")
	require.True(t, st.Behind(cursors), "the edit must leave the tenant behind")
	require.Equal(t, UpdateCursor{Updated: 30, ID: 1}, st.UpdatesHead)
}

func TestStatus_IgnoresNativeSnowflakeRows(t *testing.T) {
	r := &fakeReader{rows: makeRows(5)} // legacy IDs 1..5
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	_, cursors, err := m.Migrate(context.Background(), req("stacks-1", 10), Cursors{})
	require.NoError(t, err)

	// A native write whose masked snowflake legacy ID lands inside the legacy
	// autoincrement range. Provenance must key on legacy_migrated, not the id value.
	native := BackfillRecord{Namespace: "stacks-1", Name: "a-native", Time: 9999, LegacyID: 3}
	w.rows[pk(native)] = storedRow{rec: native, migrated: false}

	st, err := m.Status(context.Background(), req("stacks-1", 0), cursors)
	require.NoError(t, err)
	require.Equal(t, int64(5), st.LegacyCount)
	require.Equal(t, int64(5), st.MigratedCount, "a native row must not inflate the migrated count")
	require.False(t, st.BackfillPending)
}

func TestStatus_PropagatesLatestChangeError(t *testing.T) {
	r := &fakeReader{rows: makeRows(2), latestChangeErr: fmt.Errorf("boom")}
	m := ProvideMigrator(r, newFakeWriter(), nil)

	_, err := m.Status(context.Background(), req("stacks-1", 0), Cursors{})
	require.ErrorContains(t, err, "boom")
}

func TestUpdateCursor_Before(t *testing.T) {
	require.True(t, UpdateCursor{}.Before(UpdateCursor{Updated: 0, ID: 1}), "zero cursor precedes the first row")
	require.True(t, UpdateCursor{Updated: 10, ID: 5}.Before(UpdateCursor{Updated: 11, ID: 1}))
	require.True(t, UpdateCursor{Updated: 10, ID: 5}.Before(UpdateCursor{Updated: 10, ID: 6}), "id breaks ties")
	require.False(t, UpdateCursor{Updated: 10, ID: 5}.Before(UpdateCursor{Updated: 10, ID: 5}), "equal is not before")
	require.False(t, UpdateCursor{Updated: 11, ID: 1}.Before(UpdateCursor{Updated: 10, ID: 5}))
}

func TestUpdateCursor_Rewind(t *testing.T) {
	c := UpdateCursor{Updated: 100_000, ID: 7}
	require.Equal(t, UpdateCursor{Updated: 95_000}, c.rewind(5*time.Second), "the id tie-break is dropped")
	require.Equal(t, c, c.rewind(0), "no lookback is a no-op")
	require.Equal(t, c, c.rewind(-time.Second))
	require.Equal(t, UpdateCursor{}, c.rewind(time.Hour), "the rewind clamps at the start of the timeline")
}

func TestUpdateCursor_AtMost(t *testing.T) {
	c := UpdateCursor{Updated: 100, ID: 7}
	require.Equal(t, UpdateCursor{Updated: 50, ID: 1}, c.atMost(UpdateCursor{Updated: 50, ID: 1}), "capped at the limit")
	require.Equal(t, c, c.atMost(UpdateCursor{Updated: 200, ID: 1}), "a higher limit leaves it alone")
	require.Equal(t, c, c.atMost(c), "equal is not past the limit")
}

func TestSyncUpdates_AppliesEditAndMovesTimeWithoutDuplicating(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{
		{ID: 1, Epoch: 1000, Updated: 10, Text: "a1"},
		{ID: 2, Epoch: 2000, Updated: 20, Text: "a2"},
	}}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	_, cursors, err := m.Migrate(context.Background(), req("stacks-1", 10), Cursors{})
	require.NoError(t, err)
	require.Len(t, w.rows, 2)

	// The first pass covers both rows and advances to the last (updated, id).
	res, cursors, err := m.SyncUpdates(context.Background(), req("stacks-1", 10), cursors)
	require.NoError(t, err)
	require.Equal(t, int64(2), res.Scanned)
	require.Equal(t, int64(2), res.Updated)
	require.Zero(t, res.Inserted)
	require.Equal(t, UpdateCursor{Updated: 20, ID: 2}, cursors.Updates)

	// Edit id 1: new text, moved time, bumped `updated`.
	r.rows[0] = LegacyAnnotation{ID: 1, Epoch: 1500, Updated: 30, Text: "a1-edited"}

	res, cursors, err = m.SyncUpdates(context.Background(), req("stacks-1", 10), cursors)
	require.NoError(t, err)
	require.Equal(t, int64(1), res.Scanned, "resuming sees only the edited row")
	require.Equal(t, int64(1), res.Updated)
	require.Equal(t, UpdateCursor{Updated: 30, ID: 1}, cursors.Updates)

	require.Len(t, w.rows, 2, "the move must not leave a copy")
	got, ok := w.rows[rowAt("stacks-1", 1, 1500)]
	require.True(t, ok, "legacy-1 should exist at the new time")
	require.Equal(t, "a1-edited", got.rec.Text)
	_, oldExists := w.rows[rowAt("stacks-1", 1, 1000)]
	require.False(t, oldExists, "old-time row must be removed")
}

func TestSyncUpdates_DryRunWritesNothing(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{{ID: 1, Epoch: 1000, Updated: 10}}}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	_, cursors, err := m.Migrate(context.Background(), req("stacks-1", 10), Cursors{})
	require.NoError(t, err)
	require.Len(t, w.rows, 1)

	// The backfill has copied this row, so only DryRun holds the write back.
	r.rows[0] = LegacyAnnotation{ID: 1, Epoch: 1500, Updated: 30}
	res, cursors, err := m.SyncUpdates(context.Background(),
		Request{OrgID: 1, Namespace: "stacks-1", BatchSize: 10, DryRun: true}, cursors)
	require.NoError(t, err)
	require.Equal(t, int64(1), res.Scanned)
	require.Zero(t, res.Skipped, "the record was eligible; only the dry run stopped it")
	require.Zero(t, res.Updated)
	require.Equal(t, int64(1000), w.rows[rowAt("stacks-1", 1, 1000)].rec.Time, "dry run must not apply the edit")
	require.Equal(t, UpdateCursor{Updated: 30, ID: 1}, cursors.Updates, "cursor reports the full range scanned")
}

func TestSyncUpdates_PagesAcrossBatches(t *testing.T) {
	rows := make([]LegacyAnnotation, 5)
	for i := range rows {
		rows[i] = LegacyAnnotation{ID: int64(i + 1), Epoch: int64(1000 + i), Updated: int64(10 + i)}
	}
	r := &fakeReader{rows: rows}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	_, cursors, err := m.Migrate(context.Background(), req("stacks-1", 10), Cursors{})
	require.NoError(t, err)

	res, cursors, err := m.SyncUpdates(context.Background(), req("stacks-1", 2), cursors)
	require.NoError(t, err)
	require.Equal(t, int64(5), res.Scanned)
	require.Equal(t, int64(5), res.Updated)
	require.Equal(t, UpdateCursor{Updated: 14, ID: 5}, cursors.Updates)
	require.Len(t, w.rows, 5)
}

func TestSyncUpdates_PropagatesLatestChangeError(t *testing.T) {
	r := &fakeReader{rows: makeRows(2), latestChangeErr: fmt.Errorf("boom")}
	m := ProvideMigrator(r, newFakeWriter(), nil)

	_, cursors, err := m.SyncUpdates(context.Background(), req("stacks-1", 10), Cursors{Backfill: 4})
	require.ErrorContains(t, err, "boom")
	require.Equal(t, Cursors{Backfill: 4}, cursors, "a failed pass hands the cursors back untouched")
}

// Capping the returned cursor at a head read up front keeps a row that commits
// mid-pass inside the next lookback window. Without it the lookback would have to
// cover the whole pass duration, which is unbounded on a tenant draining a backlog.
func TestSyncUpdates_CursorNeverOutrunsHeadReadBeforeThePass(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{
		{ID: 1, Epoch: 1000, Updated: 10, Text: "a1"},
		{ID: 2, Epoch: 2000, Updated: 20, Text: "a2"},
	}}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	// A write lands after the pass has begun, past the head it read.
	r.onBatch = func() {
		if r.readCalls == 1 {
			r.rows = append(r.rows, LegacyAnnotation{ID: 3, Epoch: 3000, Updated: 30, Text: "a3"})
		}
	}

	res, cursors, err := m.SyncUpdates(context.Background(), req("stacks-1", 1), Cursors{})
	require.NoError(t, err)
	require.Equal(t, int64(3), res.Scanned, "the pass does read the row that landed under it")
	require.Equal(t, UpdateCursor{Updated: 20, ID: 2}, cursors.Updates,
		"but reports no further than the head it read up front")

	// So the next pass re-reads it, with no lookback needed to cover the pass itself.
	r.onBatch = nil
	res, cursors, err = m.SyncUpdates(context.Background(), req("stacks-1", 10), cursors)
	require.NoError(t, err)
	require.Equal(t, int64(1), res.Scanned)
	require.Equal(t, UpdateCursor{Updated: 30, ID: 3}, cursors.Updates)
}

// Holding back rows the backfill has not reached is what makes Migrate the only
// writer of new rows. Otherwise the resync inserts at the time it read, the
// backfill arrives at that id later and inserts again at the time it moved to,
// and one name ends up with two rows. Needs no rescan and no lost cursor: it is
// reachable on a tenant's first cycle.
func TestSyncUpdates_HoldsRowsTheBackfillHasNotReached(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{{ID: 1, Epoch: 1000, Updated: 10, Text: "a1"}}}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	res, cursors, err := m.SyncUpdates(context.Background(), req("stacks-1", 10), Cursors{})
	require.NoError(t, err)
	require.Equal(t, int64(1), res.Scanned)
	require.Equal(t, int64(1), res.Skipped, "held for the backfill")
	require.Zero(t, res.Updated)
	require.Empty(t, w.rows, "the resync must not write a row the backfill has not copied")
	require.Equal(t, UpdateCursor{Updated: 10, ID: 1}, cursors.Updates, "the cursor still advances past it")

	// The annotation moves before the backfill gets there.
	r.rows[0] = LegacyAnnotation{ID: 1, Epoch: 1500, Updated: 30, Text: "a1-moved"}
	_, cursors, err = m.Migrate(context.Background(), req("stacks-1", 10), cursors)
	require.NoError(t, err)
	require.Equal(t, 1, w.countByName("stacks-1", "legacy-1"), "one id, one row")
	require.Equal(t, "a1-moved", w.rows[rowAt("stacks-1", 1, 1500)].rec.Text)

	// Now the backfill owns the id, the resync applies edits in place.
	r.rows[0] = LegacyAnnotation{ID: 1, Epoch: 2000, Updated: 40, Text: "a1-edited"}
	res, _, err = m.SyncUpdates(context.Background(), req("stacks-1", 10), cursors)
	require.NoError(t, err)
	require.Equal(t, int64(1), res.Updated)
	require.Zero(t, res.Skipped)
	require.Equal(t, 1, w.countByName("stacks-1", "legacy-1"), "the edit moves the row rather than adding one")
	require.Equal(t, "a1-edited", w.rows[rowAt("stacks-1", 1, 2000)].rec.Text)
}

func TestSyncUpdates_PreservesDestinationTombstone(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{{ID: 1, Epoch: 1000, Updated: 10, Text: "a1"}}}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	_, cursors, err := m.Migrate(context.Background(), req("stacks-1", 10), Cursors{})
	require.NoError(t, err)

	// The user deletes it in the new store, then edits it in legacy.
	key, ok := w.findByName("stacks-1", "legacy-1")
	require.True(t, ok)
	row := w.rows[key]
	row.deleted = true
	w.rows[key] = row
	r.rows[0] = LegacyAnnotation{ID: 1, Epoch: 1000, Updated: 30, Text: "a1-edited"}

	res, cursors, err := m.SyncUpdates(context.Background(), req("stacks-1", 10), cursors)
	require.NoError(t, err)
	require.Equal(t, int64(1), res.Updated)

	key, ok = w.findByName("stacks-1", "legacy-1")
	require.True(t, ok)
	require.True(t, w.rows[key].deleted, "the resync must not clear the tombstone")
	require.Equal(t, "a1-edited", w.rows[key].rec.Text)

	st, err := m.Status(context.Background(), req("stacks-1", 0), cursors)
	require.NoError(t, err)
	require.Equal(t, st.LegacyCount, st.MigratedCount, "a deleted copy is still a copy")
	require.False(t, st.BackfillPending, "a user deletion must not re-trigger the backfill")
}

// The API does not reserve the legacy-<id> prefix, so a native annotation can
// hold one. The resync owns only what it wrote.
func TestSyncUpdates_LeavesARowItDidNotWriteAlone(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{{ID: 1, Epoch: 1000, Updated: 10, Text: "from-legacy"}}}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	native := BackfillRecord{Namespace: "stacks-1", Name: "legacy-1", Time: 1000, Text: "mine"}
	w.rows[pk(native)] = storedRow{rec: native, migrated: false}

	// Backfill: 1 puts the record past the id gate, so it is the provenance match
	// that spares the native row.
	res, cursors, err := m.SyncUpdates(context.Background(), req("stacks-1", 10), Cursors{Backfill: 1})
	require.NoError(t, err)
	require.Zero(t, res.Skipped, "the record was eligible to be applied")
	require.Zero(t, res.Updated)
	require.Equal(t, "mine", w.rows[pk(native)].rec.Text, "a row the migration does not own must not be overwritten")
	require.Equal(t, UpdateCursor{Updated: 10, ID: 1}, cursors.Updates, "the tenant's cursor must not stall on it")
}

// Legacy `updated` is stamped before the write commits, so a row can land behind
// a cursor the scan has already passed. Without a lookback it never converges.
func TestSyncUpdates_LookbackReplaysRowBehindTheCursor(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{
		{ID: 1, Epoch: 1000, Updated: 100_000, Text: "a1"},
		{ID: 2, Epoch: 2000, Updated: 100_000, Text: "a2"},
	}}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	_, _, err := m.Migrate(context.Background(), req("stacks-1", 10), Cursors{})
	require.NoError(t, err)
	cursors := Cursors{Backfill: 2, Updates: UpdateCursor{Updated: 100_000, ID: 2}}

	// A transaction stamped 3s before the cursor commits now.
	r.rows[0] = LegacyAnnotation{ID: 1, Epoch: 1000, Updated: 97_000, Text: "a1-edited"}

	res, next, err := m.SyncUpdates(context.Background(), req("stacks-1", 10), cursors)
	require.NoError(t, err)
	require.Zero(t, res.Scanned, "a plain keyset scan cannot see behind its cursor")
	require.Equal(t, cursors, next)

	syncReq := req("stacks-1", 10)
	syncReq.Lookback = 5 * time.Second
	res, next, err = m.SyncUpdates(context.Background(), syncReq, cursors)
	require.NoError(t, err)
	require.Equal(t, int64(2), res.Scanned, "the rewind re-reads the whole window")
	require.Equal(t, int64(2), res.Updated)
	require.Equal(t, cursors, next, "the returned cursor never drops below the caller's")

	key, ok := w.findByName("stacks-1", "legacy-1")
	require.True(t, ok)
	require.Equal(t, "a1-edited", w.rows[key].rec.Text)
}

// The rewind is a read position only: a cursor that regressed would have the
// caller persist a position it has already passed, and rescan forever.
func TestSyncUpdates_LookbackKeepsCursorWhenNothingChanged(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{{ID: 1, Epoch: 1000, Updated: 100_000}}}
	m := ProvideMigrator(r, newFakeWriter(), nil)

	syncReq := req("stacks-1", 10)
	syncReq.Lookback = time.Minute
	at := Cursors{Backfill: 1, Updates: UpdateCursor{Updated: 100_000, ID: 1}}

	// Rewinding past the only row still reports the row's position, not the rewound one.
	_, next, err := m.SyncUpdates(context.Background(), syncReq, at)
	require.NoError(t, err)
	require.Equal(t, at, next)

	// And a rewind that finds nothing leaves it alone, even with the head at zero.
	r.rows = nil
	_, next, err = m.SyncUpdates(context.Background(), syncReq, at)
	require.NoError(t, err)
	require.Equal(t, at, next)
}

// A row that surfaces behind the cursor never moves the head, so nothing in
// Status can see it. This is why the pass is not gated: a caller that skipped it
// because the tenant looked caught up would drop exactly this row.
func TestSyncUpdates_LookbackCatchesRowBehindTheCursor(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{
		{ID: 1, Epoch: 1000, Updated: 100_000, Text: "a1"},
		{ID: 2, Epoch: 2000, Updated: 100_000, Text: "a2"},
	}}
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	_, _, err := m.Migrate(context.Background(), req("stacks-1", 10), Cursors{})
	require.NoError(t, err)
	cursors := Cursors{Backfill: 2, Updates: UpdateCursor{Updated: 100_000, ID: 2}}

	syncReq := req("stacks-1", 10)
	syncReq.Lookback = 5 * time.Second

	// A transaction stamped before the cursor was taken commits now, exposing a row
	// the keyset scan has already passed.
	r.rows[0] = LegacyAnnotation{ID: 1, Epoch: 1000, Updated: 97_000, Text: "a1-late"}

	st, err := m.Status(context.Background(), syncReq, cursors)
	require.NoError(t, err)
	require.Equal(t, UpdateCursor{Updated: 100_000, ID: 2}, st.UpdatesHead, "the late row does not move the head")
	require.False(t, st.Behind(cursors), "the tenant looks caught up")

	// The pass runs anyway, and the lookback is what finds the row.
	_, _, err = m.SyncUpdates(context.Background(), syncReq, cursors)
	require.NoError(t, err)

	key, ok := w.findByName("stacks-1", "legacy-1")
	require.True(t, ok)
	require.Equal(t, "a1-late", w.rows[key].rec.Text, "the late row must converge")
}

// The lookback rewinds the scan, not the tenant's reported position, so it must
// not reach Status at all.
func TestStatus_LookbackDoesNotAffectReportedPosition(t *testing.T) {
	r := &fakeReader{rows: []LegacyAnnotation{{ID: 1, Epoch: 1000, Updated: 100_000}}}
	m := ProvideMigrator(r, newFakeWriter(), nil)
	at := Cursors{Backfill: 1, Updates: UpdateCursor{Updated: 100_000, ID: 1}}

	syncReq := req("stacks-1", 0)
	syncReq.Lookback = time.Minute

	withLookback, err := m.Status(context.Background(), syncReq, at)
	require.NoError(t, err)
	without, err := m.Status(context.Background(), req("stacks-1", 0), at)
	require.NoError(t, err)
	require.Equal(t, without, withLookback, "the lookback is a scan concern only")
	require.False(t, withLookback.Behind(at), "the cursor is at the head")
}

func TestStatus_BehindIsFalseAtTheHead(t *testing.T) {
	head := UpdateCursor{Updated: 100_000, ID: 7}
	st := Status{UpdatesHead: head}

	require.False(t, st.Behind(Cursors{Updates: head}), "a cursor at the head is caught up")
	require.False(t, st.Behind(Cursors{Updates: UpdateCursor{Updated: 100_001}}), "a cursor past the head is caught up")
	require.True(t, st.Behind(Cursors{Updates: UpdateCursor{Updated: 100_000, ID: 6}}), "an earlier id trails the head")
	require.True(t, st.Behind(Cursors{}), "a zero cursor trails a non-zero head")
	require.False(t, Status{}.Behind(Cursors{}), "an empty tenant is never behind")
}
