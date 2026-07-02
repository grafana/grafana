package migrator

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	annotation "github.com/grafana/grafana/pkg/registry/apps/annotation"
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

func (f *fakeReader) MaxID(_ context.Context, _ int64) (int64, error) {
	var max int64
	for _, r := range f.rows {
		if r.ID > max {
			max = r.ID
		}
	}
	return max, nil
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

// fakeWriter mimics BulkInsert against the (namespace, name, time) primary key
// with ON CONFLICT DO NOTHING, and tracks legacy IDs for the convergence count.
type fakeWriter struct {
	rows         map[string]annotation.BackfillRecord
	insertCalls  int
	insertErr    error
	errOnCallNum int
}

func newFakeWriter() *fakeWriter {
	return &fakeWriter{rows: map[string]annotation.BackfillRecord{}}
}

func pk(r annotation.BackfillRecord) string {
	return fmt.Sprintf("%s|%s|%d", r.Namespace, r.Name, r.Time)
}

func (w *fakeWriter) BulkInsert(_ context.Context, recs []annotation.BackfillRecord) (int64, error) {
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
		w.rows[key] = r
		inserted++
	}
	return inserted, nil
}

func (w *fakeWriter) CountMigratedUpTo(_ context.Context, namespace string, maxLegacyID int64) (int64, error) {
	var count int64
	for _, r := range w.rows {
		if r.Namespace == namespace && r.LegacyID > 0 && r.LegacyID <= maxLegacyID {
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
	r := &fakeReader{rows: makeRows(5)} // legacy IDs 1..5, MaxID = 5
	w := newFakeWriter()
	m := ProvideMigrator(r, w, nil)

	_, err := m.Migrate(context.Background(), req("stacks-1", 10))
	require.NoError(t, err)

	// Simulate a natively-created annotation with a large snowflake legacy ID.
	native := annotation.BackfillRecord{Namespace: "stacks-1", Name: "a-native", Time: 9999, LegacyID: 1 << 40}
	w.rows[pk(native)] = native

	legacy, migrated, err := m.VerifyCounts(context.Background(), req("stacks-1", 0))
	require.NoError(t, err)
	require.Equal(t, int64(5), legacy)
	require.Equal(t, int64(5), migrated, "snowflake row must not inflate the migrated count")
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
