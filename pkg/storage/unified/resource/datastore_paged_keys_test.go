package resource

import (
	"bytes"
	"context"
	"fmt"
	"iter"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// recordingKV serves a fixed set of keys from memory and records the options of
// every Keys call, so tests can assert on how a scan was split into statements.
type recordingKV struct {
	KV
	keys  []string
	calls []ListOptions
}

func (k *recordingKV) Keys(_ context.Context, _ string, opt ListOptions) iter.Seq2[string, error] {
	k.calls = append(k.calls, opt)

	matching := make([]string, 0, len(k.keys))
	for _, key := range k.keys {
		if key < opt.StartKey {
			continue
		}
		if opt.EndKey != "" && key >= opt.EndKey {
			continue
		}
		matching = append(matching, key)
	}
	if opt.Sort == SortOrderDesc {
		sort.Sort(sort.Reverse(sort.StringSlice(matching)))
	}

	return func(yield func(string, error) bool) {
		for i, key := range matching {
			if opt.Limit > 0 && int64(i) >= opt.Limit {
				return
			}
			if !yield(key, nil) {
				return
			}
		}
	}
}

func newRecordingKV(count int) *recordingKV {
	keys := make([]string, 0, count)
	for i := range count {
		keys = append(keys, fmt.Sprintf("key-%04d", i))
	}
	return &recordingKV{keys: keys}
}

func collectPagedKeys(t *testing.T, seq iter.Seq2[string, error]) []string {
	t.Helper()
	var got []string
	for key, err := range seq {
		require.NoError(t, err)
		got = append(got, key)
	}
	return got
}

func TestPagedKeys(t *testing.T) {
	ctx := context.Background()

	t.Run("yields the whole range across pages", func(t *testing.T) {
		store := newRecordingKV(minKeyScanPage * 5)

		got := collectPagedKeys(t, pagedKeys(ctx, store, dataSection, ListOptions{}, minKeyScanPage))

		require.Equal(t, store.keys, got)
		require.Greater(t, len(store.calls), 1, "expected the range to be split into pages")
		for _, call := range store.calls {
			require.NotZero(t, call.Limit, "every statement must be bounded")
		}
	})

	t.Run("yields the whole range in descending order", func(t *testing.T) {
		store := newRecordingKV(minKeyScanPage * 3)
		want := make([]string, len(store.keys))
		copy(want, store.keys)
		sort.Sort(sort.Reverse(sort.StringSlice(want)))

		got := collectPagedKeys(t, pagedKeys(ctx, store, dataSection, ListOptions{Sort: SortOrderDesc}, minKeyScanPage))

		require.Equal(t, want, got)
	})

	t.Run("stops reading once the consumer stops", func(t *testing.T) {
		store := newRecordingKV(minKeyScanPage * 10)

		var got []string
		for key := range pagedKeys(ctx, store, dataSection, ListOptions{}, minKeyScanPage) {
			got = append(got, key)
			if len(got) == 3 {
				break
			}
		}

		require.Len(t, got, 3)
		require.Len(t, store.calls, 1, "a consumer that stops early must not trigger another statement")
	})

	t.Run("terminates on a range that fits exactly in one page", func(t *testing.T) {
		store := newRecordingKV(minKeyScanPage)

		got := collectPagedKeys(t, pagedKeys(ctx, store, dataSection, ListOptions{}, minKeyScanPage))

		require.Equal(t, store.keys, got)
	})

	t.Run("honours the range bounds", func(t *testing.T) {
		store := newRecordingKV(minKeyScanPage * 3)
		opts := ListOptions{StartKey: "key-0010", EndKey: "key-0150"}

		got := collectPagedKeys(t, pagedKeys(ctx, store, dataSection, opts, minKeyScanPage))

		require.Equal(t, store.keys[10:150], got)
	})
}

// midScanWriteKV runs inject just before serving the nth data-section Keys
// statement, so a test can commit data while a paged key scan sits between two
// of its statements.
type midScanWriteKV struct {
	KV
	on     int
	calls  int
	inject func()
}

func (k *midScanWriteKV) Keys(ctx context.Context, section string, opt ListOptions) iter.Seq2[string, error] {
	if section == dataSection {
		k.calls++
		if k.calls == k.on && k.inject != nil {
			// Writing scans keys itself, so disarm before running the write.
			inject := k.inject
			k.inject = nil
			inject()
		}
	}
	return k.KV.Keys(ctx, section, opt)
}

// TestKvStorageBackend_ListIterator_FirstPageIsPinned covers the snapshot a
// bounded scan would otherwise lose. Such a scan is several statements, so a
// write committed between two of them is visible to the later ones - but the
// page must still be the state of the resource version it is returned under,
// the same way a continued page is pinned by its token.
func TestKvStorageBackend_ListIterator_FirstPageIsPinned(t *testing.T) {
	ctx := context.Background()
	store := &midScanWriteKV{KV: setupBadgerKV(t)}
	backend := setupTestStorageBackend(t, withKV(store))
	ns := NamespacedResource{Namespace: "default", Group: "apps", Resource: "resources"}

	// A range that is mostly tombstones, so the first page needs more than one
	// statement to find anything and there is a boundary to write across. The
	// live names sort after the deleted ones, so the scan reaches them last.
	for i := range minKeyScanPage {
		name := fmt.Sprintf("deleted-%04d", i)
		rv, obj := addTestObject(t, backend, ctx, ns, name, "data")
		deleteTestObject(t, backend, ctx, obj, rv, ns, name)
	}
	addTestObject(t, backend, ctx, ns, "live-0000", "data")

	listReq := &resourcepb.ListRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{Namespace: ns.Namespace, Group: ns.Group, Resource: ns.Resource},
		},
		// Small enough that the scan pages, large enough to carry both live
		// resources if the scan were to see the injected one.
		Limit: 5,
	}

	list := func() (int64, []string) {
		var names []string
		rv, err := backend.ListIterator(ctx, listReq, func(iter ListIterator) error {
			for iter.Next() {
				if err := iter.Error(); err != nil {
					return err
				}
				names = append(names, iter.Name())
			}
			return iter.Error()
		})
		require.NoError(t, err)
		return rv, names
	}

	// Commit a live resource between the first and second statement of the scan.
	store.calls = 0
	store.on = 2
	store.inject = func() { addTestObject(t, backend, ctx, ns, "live-injected", "data") }

	rv, names := list()
	require.Greater(t, store.calls, 1, "expected the scan to be split into statements")
	require.Nil(t, store.inject, "expected the write to land mid-scan")
	require.Equal(t, []string{"live-0000"}, names, "a write committed mid-scan must not appear in a page pinned before it")

	// The control: the write did happen, and is there to be read by a list that
	// starts after it.
	nextRV, names := list()
	require.Equal(t, []string{"live-0000", "live-injected"}, names)
	require.Greater(t, nextRV, rv)
}

func TestIntegrationDataStore_ListResourceKeysAtRevision_Limit(t *testing.T) {
	runDataStoreTestWith(t, "badger", setupTestDataStore, testDataStoreListResourceKeysAtRevisionLimit)
	runDataStoreTestWith(t, "sqlkv", setupTestDataStoreSqlKv, testDataStoreListResourceKeysAtRevisionLimit)
}

// testDataStoreListResourceKeysAtRevisionLimit covers the shape that made
// cluster-wide job lists scan the entire keyspace: a range where almost every
// key belongs to a resource that has since been deleted, so the scan reads far
// more keys than it yields, and the live resources sort last.
func testDataStoreListResourceKeysAtRevisionLimit(t *testing.T, ctx context.Context, ds *dataStore) {
	testutil.SkipIntegrationTestInShortMode(t)

	const (
		deletedResources = minKeyScanPage * 2
		liveResources    = 5
	)

	save := func(name string, action kv.DataAction) {
		key := DataKey{
			Group:           "apps",
			Resource:        "resources",
			Namespace:       "default",
			Name:            name,
			ResourceVersion: node.Generate().Int64(),
			Action:          action,
			Folder:          "test-folder",
		}
		require.NoError(t, ds.Save(ctx, key, bytes.NewReader([]byte(name))))
	}

	// Deleted resources sort before the live ones, so a scan has to read past
	// all of them before it can yield anything.
	for i := range deletedResources {
		name := fmt.Sprintf("deleted-%04d", i)
		save(name, DataActionCreated)
		save(name, DataActionUpdated)
		save(name, DataActionDeleted)
	}
	want := make([]string, 0, liveResources)
	for i := range liveResources {
		name := fmt.Sprintf("live-%04d", i)
		save(name, DataActionCreated)
		want = append(want, name)
	}

	listKey := ListRequestKey{Group: "apps", Resource: "resources", Namespace: "default"}

	names := func(opts ListRequestOptions) []string {
		var got []string
		for dataKey, err := range ds.ListResourceKeysAtRevision(ctx, opts) {
			require.NoError(t, err)
			got = append(got, dataKey.Name)
		}
		return got
	}

	t.Run("a bounded scan finds the live resources behind the deleted ones", func(t *testing.T) {
		require.Equal(t, want, names(ListRequestOptions{Key: listKey, Limit: liveResources}))
	})

	t.Run("a bounded scan matches an unbounded one", func(t *testing.T) {
		require.Equal(t, names(ListRequestOptions{Key: listKey}), names(ListRequestOptions{Key: listKey, Limit: liveResources + 1}))
	})

	t.Run("the limit caps the number of keys yielded", func(t *testing.T) {
		require.Equal(t, want[:2], names(ListRequestOptions{Key: listKey, Limit: 2}))
	})
}
