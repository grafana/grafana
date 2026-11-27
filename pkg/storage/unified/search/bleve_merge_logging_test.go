package search

import (
	"fmt"
	"slices"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/index/scorch"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestBleveMergeLoggingIndexAttribution(t *testing.T) {
	key := newTestNsResource()
	root := t.TempDir()
	sampler := bleveMergeSampler{limiter: &bleveMergeLogLimiter{}}

	for _, source := range []string{"new", "reopened", "restored"} {
		t.Run(source, func(t *testing.T) {
			logger := &mergeTestLogger{Logger: log.NewNopLogger()}
			opts := BleveOptions{Root: root, FileThreshold: 1, BuildVersion: "11.5.0", Logger: logger}
			if source == "restored" {
				opts.Root = t.TempDir()
				store := newTestKVRemoteIndexStore(t)
				opts.Snapshot = SnapshotOptions{Store: store, MinDocCount: 1, MaxIndexAge: time.Hour}
				seedDownloadableSnapshot(t, t.Context(), store, key, makeULID(t, time.Now()), &IndexMeta{
					BuildVersion: opts.BuildVersion, LatestResourceVersion: 42, UploadTimestamp: time.Now(),
				})
			}
			backend, err := NewBleveBackend(opts, nil)
			require.NoError(t, err)
			t.Cleanup(backend.Stop)

			built := false
			_, err = backend.BuildIndex(t.Context(), key, 1, "startup", func(idx resource.ResourceIndex) (int64, error) {
				built = true
				return 42, idx.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{{
					Action: resource.ActionIndex,
					Doc: &resource.IndexableDocument{
						RV: 42, Name: "initial-doc", Title: "Initial document",
						Key: &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "initial-doc"},
					},
				}}})
			}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
			require.NoError(t, err)
			require.Equal(t, source == "new", built)
			idx := backend.peekCachedIndex(key)
			require.NotNil(t, idx)
			require.Equal(t, indexStorageFile, idx.indexStorage)

			calls := forceTestDiskMerge(t, idx.index, source)
			sampler.sample(backend, time.Nanosecond)
			entries := logger.entries()
			require.Len(t, entries, 1)
			require.Equal(t, key.Namespace, entries[0]["namespace"])
			require.Equal(t, key.Group, entries[0]["group"])
			require.Equal(t, key.Resource, entries[0]["resource"])
			require.GreaterOrEqual(t, entries[0]["merge_calls"], calls, "the first sample can also include merges during open")
			require.Positive(t, entries[0]["merge_elapsed_ms"])
			require.NotContains(t, entries[0], "sample_window_ms", "first sample includes work since open")
			require.Len(t, sampler.last, 1, "old handles must not keep a baseline")
		})
	}
}

func TestBleveMergeLoggingProcessLimit(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		logger := &mergeTestLogger{Logger: log.NewNopLogger()}
		// Use fixed counters here so the fake clock doesn't affect Bleve's own timing.
		indexes := make([]bleveDiskMergeStats, 5)
		for i := range indexes {
			key := newTestNsResource()
			key.Namespace = fmt.Sprintf("ns-%d", i)
			indexes[i] = bleveDiskMergeStats{key: key, stats: &scorch.Stats{
				TotFileMergeZapTime: uint64(time.Duration(i+1) * time.Second),
				TotFileMergeZapEnd:  1,
			}}
		}
		first, second := indexes[:4], indexes[4:]
		limiter := &bleveMergeLogLimiter{}
		a := bleveMergeSampler{limiter: limiter}
		b := bleveMergeSampler{limiter: limiter}
		a.logSample(logger, first, bleveMergeLogMinElapsed)
		entries := logger.entries()
		require.Len(t, entries, 3)
		for i, namespace := range []string{"ns-3", "ns-2", "ns-1"} {
			require.Equal(t, namespace, entries[i]["namespace"])
		}

		time.Sleep(time.Minute - time.Second)
		b.logSample(logger, second, bleveMergeLogMinElapsed)
		require.Len(t, logger.entries(), 3, "the other backend shares the rolling limit")

		time.Sleep(time.Second)
		a.logSample(logger, first, bleveMergeLogMinElapsed)
		b.logSample(logger, second, bleveMergeLogMinElapsed)
		require.Len(t, logger.entries(), 3, "suppressed work must not be replayed")

		second[0].stats.TotFileMergeZapTime += uint64(time.Second)
		second[0].stats.TotFileMergeZapEnd++
		time.Sleep(time.Minute)
		b.logSample(logger, second, bleveMergeLogMinElapsed)
		entries = logger.entries()
		require.Len(t, entries, 4)
		require.Equal(t, "ns-4", entries[3]["namespace"])
		require.Equal(t, uint64(1), entries[3]["merge_calls"])
		require.Equal(t, float64(1000), entries[3]["merge_elapsed_ms"])
		require.Equal(t, time.Minute.Milliseconds(), entries[3]["sample_window_ms"])
	})
}

func forceTestDiskMerge(t *testing.T, idx bleve.Index, prefix string) uint64 {
	t.Helper()
	inner, err := idx.Advanced()
	require.NoError(t, err)
	disk, ok := inner.(*scorch.Scorch)
	require.True(t, ok)
	stats := disk.Stats().(*scorch.Stats)
	before := atomic.LoadUint64(&stats.TotFileMergeZapEnd)
	// Use separate durable batches so the merger can see more than one disk segment.
	for i := range 2 {
		require.NoError(t, idx.Index(fmt.Sprintf("%s-%d", prefix, i), map[string]string{"title": "merge test"}))
	}
	require.NoError(t, disk.ForceMerge(t.Context(), nil))
	after := atomic.LoadUint64(&stats.TotFileMergeZapEnd)
	require.Greater(t, after, before)
	return after - before
}

type mergeTestLogger struct {
	log.Logger
	mu   sync.Mutex
	logs []map[string]any
}

func (l *mergeTestLogger) Info(msg string, fields ...any) {
	if msg != bleveMergeLogMessage {
		return
	}
	entry := make(map[string]any, len(fields)/2)
	for i := 0; i < len(fields); i += 2 {
		entry[fields[i].(string)] = fields[i+1]
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	l.logs = append(l.logs, entry)
}

func (l *mergeTestLogger) entries() []map[string]any {
	l.mu.Lock()
	defer l.mu.Unlock()
	return slices.Clone(l.logs)
}
