package resource

import (
	"context"
	"errors"
	"io"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// latestStores are the KV stores the latest write path is tested against.
// SQLite matters on its own: its locking differs from row-locking databases.
var latestStores = map[string]func(t *testing.T) KV{
	"badger": setupBadgerKV,
	"sqlkv":  func(t *testing.T) KV { return setupSqlKV(t) },
}

func forEachLatestStore(t *testing.T, fn func(t *testing.T, store KV)) {
	for name, newStore := range latestStores {
		t.Run(name, func(t *testing.T) {
			fn(t, newStore(t))
		})
	}
}

func setupLatestBackend(t *testing.T, store KV, configs ...func(*KVBackendOptions)) *kvStorageBackend {
	t.Helper()
	return setupTestStorageBackend(t, append([]func(*KVBackendOptions){
		withKV(store),
		withWriteCoordination(WriteCoordinationLatest),
	}, configs...)...)
}

func latestTestEvent(t *testing.T, ns NamespacedResource, eventType resourcepb.WatchEvent_Type, name, value string, previousRV int64) WriteEvent {
	t.Helper()
	obj, err := createTestObjectWithName(name, ns, value)
	require.NoError(t, err)
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	return WriteEvent{
		Type:       eventType,
		Key:        &resourcepb.ResourceKey{Group: ns.Group, Resource: ns.Resource, Namespace: ns.Namespace, Name: name},
		Value:      objectToJSONBytes(t, obj),
		Object:     meta,
		ObjectOld:  meta,
		PreviousRV: previousRV,
	}
}

func appsWriteEvent(t *testing.T, eventType resourcepb.WatchEvent_Type, name, value string, previousRV int64) WriteEvent {
	t.Helper()
	return latestTestEvent(t, appsNamespace, eventType, name, value, previousRV)
}

func readLatestVersion(t *testing.T, backend *kvStorageBackend, ns NamespacedResource, name string) latestVersion {
	t.Helper()
	latest, err := backend.dataStore.getLatestVersion(t.Context(), GetRequestKey{Group: ns.Group, Resource: ns.Resource, Namespace: ns.Namespace, Name: name})
	require.NoError(t, err)
	return latest
}

// requireLatestVersion checks that the resource's row names its newest data key.
func requireLatestVersion(t *testing.T, backend *kvStorageBackend, ns NamespacedResource, name string, rv int64, action DataAction) {
	t.Helper()
	latest := readLatestVersion(t, backend, ns, name)
	require.True(t, latest.found(), "latest version of %s must be set", name)
	require.Equal(t, rv, latest.key.ResourceVersion)
	require.Equal(t, action, latest.key.Action)

	newest, err := backend.dataStore.LastResourceVersion(t.Context(), ListRequestKey{Group: ns.Group, Resource: ns.Resource, Namespace: ns.Namespace, Name: name})
	require.NoError(t, err)
	require.Equal(t, newest, latest.key, "the latest version must be the newest data key")
}

func requireNoLatestVersion(t *testing.T, backend *kvStorageBackend, ns NamespacedResource, name string) {
	t.Helper()
	require.False(t, readLatestVersion(t, backend, ns, name).found(), "latest version of %s must not be set", name)
}

func requireStoredValue(t *testing.T, backend *kvStorageBackend, name string, rv int64, event WriteEvent) {
	t.Helper()
	rsp := backend.ReadResource(t.Context(), &resourcepb.ReadRequest{Key: appsKey(name)})
	require.Nil(t, rsp.Error)
	require.Equal(t, rv, rsp.ResourceVersion)
	require.Equal(t, event.Value, rsp.Value)
}

func countVersions(t *testing.T, backend *kvStorageBackend, ns NamespacedResource, name string) int {
	t.Helper()
	n := 0
	for _, err := range backend.dataStore.Keys(t.Context(), ListRequestKey{
		Group: ns.Group, Resource: ns.Resource, Namespace: ns.Namespace, Name: name,
	}, SortOrderAsc) {
		require.NoError(t, err)
		n++
	}
	return n
}

func latestKeys(t *testing.T, store KV) []string {
	t.Helper()
	var keys []string
	for k, err := range store.Keys(t.Context(), latestSection, ListOptions{}) {
		require.NoError(t, err)
		keys = append(keys, k)
	}
	return keys
}

func TestLatestWrites_TrackLatestVersion(t *testing.T) {
	forEachLatestStore(t, func(t *testing.T, store KV) {
		backend := setupLatestBackend(t, store)
		ctx := t.Context()

		rv1, err := backend.WriteEvent(ctx, appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "item", "v1", 0))
		require.NoError(t, err)
		requireLatestVersion(t, backend, appsNamespace, "item", rv1, DataActionCreated)

		_, err = backend.WriteEvent(ctx, appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "item", "again", 0))
		require.ErrorIs(t, err, ErrResourceAlreadyExists)

		update := appsWriteEvent(t, resourcepb.WatchEvent_MODIFIED, "item", "v2", rv1)
		rv2, err := backend.WriteEvent(ctx, update)
		require.NoError(t, err)
		requireLatestVersion(t, backend, appsNamespace, "item", rv2, DataActionUpdated)
		requireStoredValue(t, backend, "item", rv2, update)

		_, err = backend.WriteEvent(ctx, appsWriteEvent(t, resourcepb.WatchEvent_MODIFIED, "item", "stale", rv1))
		require.True(t, apierrors.IsConflict(err), "expected conflict, got %v", err)

		rv3, err := backend.WriteEvent(ctx, appsWriteEvent(t, resourcepb.WatchEvent_DELETED, "item", "v2", rv2))
		require.NoError(t, err)
		requireLatestVersion(t, backend, appsNamespace, "item", rv3, DataActionDeleted)

		_, err = backend.WriteEvent(ctx, appsWriteEvent(t, resourcepb.WatchEvent_MODIFIED, "item", "deleted", rv3))
		require.True(t, apierrors.IsConflict(err), "updating a deleted resource must conflict, got %v", err)

		recreate := appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "item", "v4", 0)
		rv4, err := backend.WriteEvent(ctx, recreate)
		require.NoError(t, err)
		require.Greater(t, rv4, rv3, "a recreated resource must sort after its tombstone")
		requireLatestVersion(t, backend, appsNamespace, "item", rv4, DataActionCreated)
		requireStoredValue(t, backend, "item", rv4, recreate)

		// An update from the deleted incarnation does not apply to the new one.
		_, err = backend.WriteEvent(ctx, appsWriteEvent(t, resourcepb.WatchEvent_MODIFIED, "item", "old incarnation", rv2))
		require.True(t, apierrors.IsConflict(err), "expected conflict, got %v", err)

		require.Equal(t, 4, countVersions(t, backend, appsNamespace, "item"))
	})
}

func TestLatestWrites_DoNotTakeWriteLeases(t *testing.T) {
	store := setupBadgerKV(t)
	backend := setupLatestBackend(t, store)
	_, err := backend.WriteEvent(t.Context(), appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "item", "v1", 0))
	require.NoError(t, err)

	for k, err := range store.Keys(t.Context(), kv.LeasesSection, ListOptions{}) {
		require.NoError(t, err)
		require.NotContains(t, k, "write/", "latest writes must not take write leases")
	}
}

func TestLeaseWrites_DoNotWriteLatestVersions(t *testing.T) {
	store := setupBadgerKV(t)
	backend := setupTestStorageBackend(t, withKV(store))
	require.Equal(t, WriteCoordinationLease, backend.writeCoordination, "lease is the default")

	rv, err := backend.WriteEvent(t.Context(), appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "item", "v1", 0))
	require.NoError(t, err)
	_, err = backend.WriteEvent(t.Context(), appsWriteEvent(t, resourcepb.WatchEvent_MODIFIED, "item", "v2", rv))
	require.NoError(t, err)
	require.Empty(t, latestKeys(t, store))
}

func TestNewKVStorageBackendRejectsInvalidWriteCoordination(t *testing.T) {
	_, err := NewKVStorageBackend(KVBackendOptions{KvStore: setupBadgerKV(t), WriteCoordination: "optimistic"})
	require.ErrorContains(t, err, `invalid write coordination "optimistic"`)
}

// pausingDataBatchKV, once armed, holds the next batch that writes data until
// resumed, as a writer stalled between its checks and its commit would be.
type pausingDataBatchKV struct {
	KV
	mu     sync.Mutex
	paused chan struct{}
	resume chan struct{}
}

func (p *pausingDataBatchKV) arm() (paused, resume chan struct{}) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.paused, p.resume = make(chan struct{}), make(chan struct{})
	return p.paused, p.resume
}

func (p *pausingDataBatchKV) Batch(ctx context.Context, section string, ops []BatchOp) error {
	if slices.ContainsFunc(ops, func(op BatchOp) bool { return op.Section == kv.DataSection }) {
		p.mu.Lock()
		paused, resume := p.paused, p.resume
		p.paused, p.resume = nil, nil
		p.mu.Unlock()
		if paused != nil {
			close(paused)
			<-resume
		}
	}
	return p.KV.Batch(ctx, section, ops)
}

type writeResult struct {
	rv  int64
	err error
}

func writeAsync(ctx context.Context, backend *kvStorageBackend, event WriteEvent) <-chan writeResult {
	done := make(chan writeResult, 1)
	go func() {
		rv, err := backend.WriteEvent(ctx, event)
		done <- writeResult{rv: rv, err: err}
	}()
	return done
}

// A writer that stalls after its checks, for however long, must not commit
// over a write that landed in the meantime. With a write lease this was only
// guaranteed while the stalled writer's lease had not expired.
func TestLatestWrites_StalledWriterLosesToLaterWrite(t *testing.T) {
	forEachLatestStore(t, func(t *testing.T, kvStore KV) {
		store := &pausingDataBatchKV{KV: kvStore}
		backend := setupLatestBackend(t, store)
		rv0, err := backend.WriteEvent(t.Context(), appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "item", "v0", 0))
		require.NoError(t, err)

		paused, resume := store.arm()
		stalled := writeAsync(t.Context(), backend, appsWriteEvent(t, resourcepb.WatchEvent_MODIFIED, "item", "stalled", rv0))
		<-paused

		later := appsWriteEvent(t, resourcepb.WatchEvent_MODIFIED, "item", "later", rv0)
		rvLater, err := backend.WriteEvent(t.Context(), later)
		require.NoError(t, err)

		close(resume)
		result := <-stalled
		require.True(t, apierrors.IsConflict(result.err), "expected conflict, got %v", result.err)

		requireStoredValue(t, backend, "item", rvLater, later)
		requireLatestVersion(t, backend, appsNamespace, "item", rvLater, DataActionUpdated)
		require.Equal(t, 2, countVersions(t, backend, appsNamespace, "item"), "the stalled write must not be persisted")
	})
}

// Without a competing write, a stalled writer commits whenever it resumes:
// there is no TTL after which it loses the right to.
func TestLatestWrites_StalledWriterWithoutCompetitionCommits(t *testing.T) {
	store := &pausingDataBatchKV{KV: setupBadgerKV(t)}
	backend := setupLatestBackend(t, store)
	rv0, err := backend.WriteEvent(t.Context(), appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "item", "v0", 0))
	require.NoError(t, err)

	paused, resume := store.arm()
	update := appsWriteEvent(t, resourcepb.WatchEvent_MODIFIED, "item", "v1", rv0)
	done := writeAsync(t.Context(), backend, update)
	<-paused
	close(resume)
	result := <-done

	require.NoError(t, result.err)
	require.Greater(t, result.rv, rv0)
	requireStoredValue(t, backend, "item", result.rv, update)
}

func TestLatestWrites_ConcurrentWritersOneWins(t *testing.T) {
	const writers = 8
	runConcurrently := func(write func(i int) (int64, error)) ([]int64, []error) {
		rvs := make([]int64, writers)
		errs := make([]error, writers)
		var wg sync.WaitGroup
		start := make(chan struct{})
		for i := range writers {
			wg.Go(func() {
				<-start
				rvs[i], errs[i] = write(i)
			})
		}
		close(start)
		wg.Wait()
		return rvs, errs
	}

	forEachLatestStore(t, func(t *testing.T, store KV) {
		backend := setupLatestBackend(t, store)

		t.Run("creates", func(t *testing.T) {
			rvs, errs := runConcurrently(func(int) (int64, error) {
				return backend.WriteEvent(t.Context(), appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "created", "v0", 0))
			})
			winners := 0
			for i, err := range errs {
				if err == nil {
					winners++
					requireLatestVersion(t, backend, appsNamespace, "created", rvs[i], DataActionCreated)
					continue
				}
				require.ErrorIs(t, err, ErrResourceAlreadyExists, "losing creates must see the winner")
			}
			require.Equal(t, 1, winners)
			require.Equal(t, 1, countVersions(t, backend, appsNamespace, "created"))
		})

		t.Run("updates", func(t *testing.T) {
			rv0, err := backend.WriteEvent(t.Context(), appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "updated", "v0", 0))
			require.NoError(t, err)
			rvs, errs := runConcurrently(func(int) (int64, error) {
				return backend.WriteEvent(t.Context(), appsWriteEvent(t, resourcepb.WatchEvent_MODIFIED, "updated", "v1", rv0))
			})
			winners := 0
			for i, err := range errs {
				if err == nil {
					winners++
					requireLatestVersion(t, backend, appsNamespace, "updated", rvs[i], DataActionUpdated)
					continue
				}
				require.True(t, apierrors.IsConflict(err), "expected conflict, got %v", err)
			}
			require.Equal(t, 1, winners)
			require.Equal(t, 2, countVersions(t, backend, appsNamespace, "updated"))
		})
	})
}

// A deleted resource's row goes when garbage collection purges it, unless the
// resource was recreated since.
func TestLatestWrites_GarbageCollection(t *testing.T) {
	for _, dryRun := range []bool{false, true} {
		t.Run(map[bool]string{false: "collect", true: "dry run"}[dryRun], func(t *testing.T) {
			ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))
			backend := setupLatestBackend(t, setupBadgerKV(t), func(opts *KVBackendOptions) {
				opts.GarbageCollection = GarbageCollectionConfig{Enabled: true, DryRun: dryRun, Interval: time.Minute, BatchSize: 100}
			})

			rv, err := backend.WriteEvent(ctx, appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "gone", "v0", 0))
			require.NoError(t, err)
			goneRV, err := backend.WriteEvent(ctx, appsWriteEvent(t, resourcepb.WatchEvent_DELETED, "gone", "v0", rv))
			require.NoError(t, err)

			rv, err = backend.WriteEvent(ctx, appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "back", "v0", 0))
			require.NoError(t, err)
			_, err = backend.WriteEvent(ctx, appsWriteEvent(t, resourcepb.WatchEvent_DELETED, "back", "v0", rv))
			require.NoError(t, err)
			backRV, err := backend.WriteEvent(ctx, appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "back", "v1", 0))
			require.NoError(t, err)

			cutoff := backend.garbageCollectionCutoffTimestamp(appsNamespace.Group, appsNamespace.Resource, time.Now().Add(time.Hour).UnixMicro())
			_, err = backend.garbageCollectGroupResource(ctx, appsNamespace.Group, appsNamespace.Resource, cutoff)
			require.NoError(t, err)

			if dryRun {
				requireLatestVersion(t, backend, appsNamespace, "gone", goneRV, DataActionDeleted)
			} else {
				require.Zero(t, countVersions(t, backend, appsNamespace, "gone"))
				requireNoLatestVersion(t, backend, appsNamespace, "gone")
			}
			latest := readLatestVersion(t, backend, appsNamespace, "back")
			require.Equal(t, backRV, latest.key.ResourceVersion, "a recreated resource keeps its latest version")

			// A purged resource can be created again.
			_, err = backend.WriteEvent(ctx, appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "gone", "v1", 0))
			require.NoError(t, err)
		})
	}
}

var latestBulkNamespace = NamespacedResource{Namespace: "bulk-ns", Group: testBulkImportGroup, Resource: testBulkImportResource}

func latestBulkSettings() BulkSettings {
	return BulkSettings{Collection: []*resourcepb.ResourceKey{{
		Namespace: latestBulkNamespace.Namespace, Group: latestBulkNamespace.Group, Resource: latestBulkNamespace.Resource,
	}}}
}

// A bulk import replaces its collection, so the rows of the resources it held
// go and the newest imported version of each resource becomes its latest.
func TestLatestWrites_BulkImport(t *testing.T) {
	forEachLatestStore(t, func(t *testing.T, store KV) {
		backend := setupLatestBackend(t, store)
		ctx := t.Context()
		ns := latestBulkNamespace.Namespace

		_, err := backend.WriteEvent(ctx, latestTestEvent(t, latestBulkNamespace, resourcepb.WatchEvent_ADDED, "replaced", "v0", 0))
		require.NoError(t, err)
		other, err := backend.WriteEvent(ctx, appsWriteEvent(t, resourcepb.WatchEvent_ADDED, "other-collection", "v0", 0))
		require.NoError(t, err)

		rsp, err := backend.ProcessBulk(ctx, latestBulkSettings(), newBatchOnlyBulkIterator(
			[]*resourcepb.BulkRequest{
				newBulkImportRequest(ns, "item-1", resourcepb.BulkRequest_ADDED),
				newBulkImportRequest(ns, "item-1", resourcepb.BulkRequest_MODIFIED),
			},
			[]*resourcepb.BulkRequest{
				newBulkImportRequest(ns, "item-2", resourcepb.BulkRequest_ADDED),
				newBulkImportRequest(ns, "item-1", resourcepb.BulkRequest_MODIFIED),
				newBulkImportRequest(ns, "item-3", resourcepb.BulkRequest_ADDED),
				newBulkImportRequest(ns, "item-3", resourcepb.BulkRequest_DELETED),
			},
		))
		require.NoError(t, err)
		require.Empty(t, rsp.Rejected)

		requireNoLatestVersion(t, backend, latestBulkNamespace, "replaced")
		requireLatestVersion(t, backend, appsNamespace, "other-collection", other, DataActionCreated)
		item1 := readLatestVersion(t, backend, latestBulkNamespace, "item-1")
		requireLatestVersion(t, backend, latestBulkNamespace, "item-1", item1.key.ResourceVersion, DataActionUpdated)
		item2 := readLatestVersion(t, backend, latestBulkNamespace, "item-2")
		requireLatestVersion(t, backend, latestBulkNamespace, "item-2", item2.key.ResourceVersion, DataActionCreated)
		item3 := readLatestVersion(t, backend, latestBulkNamespace, "item-3")
		requireLatestVersion(t, backend, latestBulkNamespace, "item-3", item3.key.ResourceVersion, DataActionDeleted)

		// Writes continue from the imported versions.
		_, err = backend.WriteEvent(ctx, latestTestEvent(t, latestBulkNamespace, resourcepb.WatchEvent_ADDED, "item-1", "dup", 0))
		require.ErrorIs(t, err, ErrResourceAlreadyExists)
		rv, err := backend.WriteEvent(ctx, latestTestEvent(t, latestBulkNamespace, resourcepb.WatchEvent_MODIFIED, "item-1", "v1", item1.key.ResourceVersion))
		require.NoError(t, err)
		requireLatestVersion(t, backend, latestBulkNamespace, "item-1", rv, DataActionUpdated)
		_, err = backend.WriteEvent(ctx, latestTestEvent(t, latestBulkNamespace, resourcepb.WatchEvent_ADDED, "item-3", "recreated", 0))
		require.NoError(t, err)
	})
}

// rollbackAfterFirstBatchIterator asks for a rollback once its first batch is
// imported.
type rollbackAfterFirstBatchIterator struct {
	*batchOnlyBulkIterator
}

func (i *rollbackAfterFirstBatchIterator) RollbackRequested() bool {
	return i.idx > 0
}

// failLatestSaveKV fails every save to the latest section.
type failLatestSaveKV struct {
	KV
}

func (f *failLatestSaveKV) Save(ctx context.Context, section, key string) (io.WriteCloser, error) {
	if section == latestSection {
		return nil, errors.New("latest section unavailable")
	}
	return f.KV.Save(ctx, section, key)
}

func TestLatestWrites_BulkImportRollback(t *testing.T) {
	ns := latestBulkNamespace.Namespace
	batch := []*resourcepb.BulkRequest{newBulkImportRequest(ns, "item-1", resourcepb.BulkRequest_ADDED)}

	t.Run("requested", func(t *testing.T) {
		store := setupBadgerKV(t)
		backend := setupLatestBackend(t, store)
		_, err := backend.ProcessBulk(t.Context(), latestBulkSettings(), &rollbackAfterFirstBatchIterator{newBatchOnlyBulkIterator(batch, batch)})
		require.NoError(t, err)
		require.Zero(t, countVersions(t, backend, latestBulkNamespace, "item-1"))
		require.Empty(t, latestKeys(t, store))
	})

	t.Run("saving latest versions fails", func(t *testing.T) {
		store := setupBadgerKV(t)
		backend := setupLatestBackend(t, &failLatestSaveKV{KV: store})
		_, err := backend.ProcessBulk(t.Context(), latestBulkSettings(), newBatchOnlyBulkIterator(batch))
		require.ErrorContains(t, err, "failed to save latest versions")
		require.Zero(t, countVersions(t, backend, latestBulkNamespace, "item-1"), "the import must be rolled back")
		require.Empty(t, latestKeys(t, store))
	})
}

func TestLatestWrites_TenantDeletionDeletesLatestVersions(t *testing.T) {
	td, ds, pds := newTestTenantDeleter(t, false)
	ds.maintainsLatest = true

	keys := make([]DataKey, 0, 2)
	for _, namespace := range []string{testStacksNS1, testStacksNS2} {
		saveTestResource(t, ds, namespace, "apps", "dashboards", "dash1", 100, nil)
		keys = append(keys, DataKey{Namespace: namespace, Group: "apps", Resource: "dashboards", Name: "dash1", ResourceVersion: 100, Action: DataActionCreated})
	}
	require.NoError(t, ds.setLatestVersions(t.Context(), keys))
	require.NoError(t, pds.Upsert(t.Context(), testStacksNS1, PendingDeleteRecord{DeleteAfter: pastTime()}))

	td.runDeletionPass(t.Context())

	remaining := latestKeys(t, ds.kv)
	require.Len(t, remaining, 1)
	require.True(t, strings.Contains(remaining[0], "/"+testStacksNS2+"/"), "other tenants keep their latest versions: %v", remaining)
}
