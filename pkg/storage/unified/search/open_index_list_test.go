package search

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestOpenIndexListWriteAndLoad(t *testing.T) {
	backend, err := NewBleveBackend(BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: 10,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	first := resource.NamespacedResource{Namespace: "ns-a", Group: "group-a", Resource: "resource-a"}
	second := resource.NamespacedResource{Namespace: "ns-b", Group: "group-b", Resource: "resource-b"}

	_, err = backend.BuildIndex(context.Background(), second, 2, "test", indexTestDocs(second, 2, 100), nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)
	_, err = backend.BuildIndex(context.Background(), first, 3, "test", indexTestDocs(first, 3, 200), nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)

	now := time.Now().UTC()
	require.NoError(t, backend.WriteOpenIndexStats(now))

	stats, err := backend.LoadOpenIndexStats(now.Add(time.Minute), time.Hour)
	require.NoError(t, err)
	require.Equal(t, []resource.ResourceStats{
		{NamespacedResource: first, Count: 3},
		{NamespacedResource: second, Count: 2},
	}, stats)
}

// A global index keeps its last search across a restart, so it is closed as
// idle once the timeout has passed since that search, not since the restart.
func TestOpenIndexListKeepsWhenAGlobalIndexWasLastSearched(t *testing.T) {
	root := t.TempDir()
	global := resource.GlobalSearchKey("ns")
	searched := time.Now().Add(-2 * time.Hour).Truncate(time.Millisecond)
	before, err := NewBleveBackend(BleveOptions{Root: root, FileThreshold: 10}, nil)
	require.NoError(t, err)
	_, err = before.BuildIndex(t.Context(), global, 2, "test", indexTestDocs(global, 2, 100), nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)
	before.peekCachedIndex(global).lastSearchedAt.Store(searched.UnixMilli())
	require.NoError(t, before.WriteOpenIndexStats(time.Now()))
	before.Stop()

	after, err := NewBleveBackend(BleveOptions{Root: root, FileThreshold: 10, GlobalIndexIdleTimeout: 3 * time.Hour}, nil)
	require.NoError(t, err)
	t.Cleanup(after.Stop)
	stats, err := after.LoadOpenIndexStats(time.Now(), time.Hour)
	require.NoError(t, err)
	require.Len(t, stats, 1)
	require.True(t, searched.Equal(stats[0].LastSearchedAt), "got %s", stats[0].LastSearchedAt)

	_, err = after.BuildIndex(t.Context(), global, 2, "init", indexTestDocs(global, 2, 100), nil, false, time.Time{}, 0,
		resource.BuildIndexOptions{LastSearchedAt: stats[0].LastSearchedAt})
	require.NoError(t, err)
	after.runEvictExpiredOrUnownedIndexes(searched.Add(3*time.Hour - time.Minute))
	require.NotNil(t, after.PeekIndex(global))
	after.runEvictExpiredOrUnownedIndexes(searched.Add(3*time.Hour + time.Minute))
	require.Nil(t, after.PeekIndex(global))
}

func TestOpenIndexListWriteRemovesOpenIndexListWhenNoIndexes(t *testing.T) {
	backend, err := NewBleveBackend(BleveOptions{Root: t.TempDir()}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	require.NoError(t, writeOpenIndexListFile(backend, "old\n"))
	require.NoError(t, backend.WriteOpenIndexStats(time.Now()))

	_, err = os.Stat(filepath.Join(backend.opts.Root, openIndexListFileName))
	require.ErrorIs(t, err, os.ErrNotExist)
}

func TestOpenIndexListLoadRejectsStaleOpenIndexList(t *testing.T) {
	backend, err := NewBleveBackend(BleveOptions{Root: t.TempDir()}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	now := time.Now().UTC()
	writeOpenIndexList(t, backend, openIndexListFile{
		WrittenAt: now.Add(-2 * time.Hour).Format(time.RFC3339Nano),
		Indexes: []openIndexListEntry{
			{Namespace: "ns", Group: "group", Resource: "resource", DocCount: 1},
		},
	})

	stats, err := backend.LoadOpenIndexStats(now, time.Hour)
	require.ErrorContains(t, err, "open index list is stale")
	require.Nil(t, stats)
}

func TestOpenIndexListLoadRejectsEmptyOpenIndexList(t *testing.T) {
	backend, err := NewBleveBackend(BleveOptions{Root: t.TempDir()}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	now := time.Now().UTC()
	writeOpenIndexList(t, backend, openIndexListFile{
		WrittenAt: now.Format(time.RFC3339Nano),
	})

	stats, err := backend.LoadOpenIndexStats(now, time.Hour)
	require.ErrorContains(t, err, "open index list has no indexes")
	require.Nil(t, stats)
}

func TestOpenIndexListLoadRejectsDuplicateEntry(t *testing.T) {
	backend, err := NewBleveBackend(BleveOptions{Root: t.TempDir()}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	now := time.Now().UTC()
	writeOpenIndexList(t, backend, openIndexListFile{
		WrittenAt: now.Format(time.RFC3339Nano),
		Indexes: []openIndexListEntry{
			{Namespace: "ns", Group: "group", Resource: "resource", DocCount: 1},
			{Namespace: "ns", Group: "group", Resource: "resource", DocCount: 1},
		},
	})

	stats, err := backend.LoadOpenIndexStats(now, time.Hour)
	require.ErrorContains(t, err, "duplicate index entry")
	require.Nil(t, stats)
}

func TestOpenIndexListLoadRejectsMalformedJSON(t *testing.T) {
	backend, err := NewBleveBackend(BleveOptions{Root: t.TempDir()}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	require.NoError(t, writeOpenIndexListFile(backend, "not-json\n"))

	stats, err := backend.LoadOpenIndexStats(time.Now(), time.Hour)
	require.ErrorContains(t, err, "invalid open index list JSON")
	require.Nil(t, stats)
}

func writeOpenIndexList(t *testing.T, backend *bleveBackend, list openIndexListFile) {
	t.Helper()

	contents, err := json.Marshal(list)
	require.NoError(t, err)
	require.NoError(t, writeOpenIndexListFile(backend, string(contents)))
}

func writeOpenIndexListFile(backend *bleveBackend, contents string) error {
	return os.WriteFile(filepath.Join(backend.opts.Root, openIndexListFileName), []byte(contents), 0o640)
}
