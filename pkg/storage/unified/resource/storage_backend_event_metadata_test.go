package resource

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/sql/rvmanager"
)

func TestKvStorageBackend_WriteEvent_PreviousRevision(t *testing.T) {
	for _, tc := range []struct {
		name  string
		setup func(*testing.T) *kvStorageBackend
	}{
		{name: "badger", setup: func(t *testing.T) *kvStorageBackend { return setupTestStorageBackend(t) }},
		{name: "leases", setup: func(t *testing.T) *kvStorageBackend {
			return setupTestStorageBackend(t, func(opts *KVBackendOptions) {
				opts.EnableKVLeases = true
				opts.Holder = "test-holder"
			})
		}},
		{name: "sqlkv", setup: func(t *testing.T) *kvStorageBackend {
			return setupTestStorageBackend(t, withKV(setupSqlKV(t)))
		}},
		{name: "compat", setup: func(t *testing.T) *kvStorageBackend {
			backend, _ := setupCompatSqlKVStorageBackend(t)
			return backend
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend := tc.setup(t)
			ctx := t.Context()
			var previous Event
			for _, step := range []struct {
				name      string
				eventType resourcepb.WatchEvent_Type
				folder    string
			}{
				{name: "create", eventType: resourcepb.WatchEvent_ADDED},
				{name: "move from root", eventType: resourcepb.WatchEvent_MODIFIED, folder: "folder-a"},
				{name: "move between folders", eventType: resourcepb.WatchEvent_MODIFIED, folder: "folder-b"},
				{name: "move to root", eventType: resourcepb.WatchEvent_MODIFIED},
				{name: "delete updated revision", eventType: resourcepb.WatchEvent_DELETED},
				{name: "recreate", eventType: resourcepb.WatchEvent_ADDED, folder: "folder-c"},
				{name: "delete created revision", eventType: resourcepb.WatchEvent_DELETED, folder: "folder-c"},
			} {
				t.Run(step.name, func(t *testing.T) {
					obj, err := createTestObjectWithName("test-resource", appsNamespace, step.name)
					require.NoError(t, err)
					meta, err := utils.MetaAccessor(obj)
					require.NoError(t, err)
					meta.SetFolder(step.folder)
					var previousRV int64
					if step.eventType != resourcepb.WatchEvent_ADDED {
						previousRV = previous.ResourceVersion
					}
					requestRV := previousRV
					if backend.rvManager != nil && previousRV > 0 {
						requestRV = rvmanager.RVFromSnowflake(previousRV)
					}
					rv, err := backend.WriteEvent(ctx, WriteEvent{
						Type:       step.eventType,
						Key:        appsKey("test-resource"),
						Value:      objectToJSONBytes(t, obj),
						Object:     meta,
						ObjectOld:  meta,
						PreviousRV: requestRV,
					})
					require.NoError(t, err)

					eventKey, err := backend.eventStore.LastEventKey(ctx)
					require.NoError(t, err)
					event, err := backend.eventStore.Get(ctx, eventKey)
					require.NoError(t, err)
					require.Equal(t, rv, event.ResourceVersion)
					require.Equal(t, step.folder, event.Folder)
					require.Equal(t, previousRV, event.PreviousRV)
					if previousRV == 0 {
						require.Empty(t, event.PreviousAction)
						require.Empty(t, event.PreviousFolder)
					} else {
						require.Equal(t, previous.Action, event.PreviousAction)
						require.Equal(t, previous.Folder, event.PreviousFolder)
					}
					previous = event
				})
			}
		})
	}
}

func TestKvStorageBackend_WriteEvent_ReusesPreviousKey(t *testing.T) {
	kvStore := &countingKV{KV: setupBadgerKV(t)}
	backend := setupTestStorageBackend(t, withKV(kvStore), func(opts *KVBackendOptions) {
		opts.DisableStorageServices = true
	})
	ctx := t.Context()
	rv := seedResource(t, backend, ctx, "test-resource", "old-folder")
	obj, err := createTestObjectWithName("test-resource", appsNamespace, "updated")
	require.NoError(t, err)
	meta, err := utils.MetaAccessor(obj)
	require.NoError(t, err)
	meta.SetFolder("new-folder")

	tripsBefore, readsBefore := kvStore.stats()
	listedBefore := kvStore.listed()
	eventReadsBefore := kvStore.eventsRead()
	_, err = backend.WriteEvent(ctx, WriteEvent{
		Type:       resourcepb.WatchEvent_MODIFIED,
		Key:        appsKey("test-resource"),
		Value:      objectToJSONBytes(t, obj),
		Object:     meta,
		ObjectOld:  meta,
		PreviousRV: rv,
	})
	require.NoError(t, err)

	tripsAfter, readsAfter := kvStore.stats()
	require.Equal(t, tripsBefore, tripsAfter, "enrichment must not read resource bodies")
	require.Equal(t, readsBefore, readsAfter)
	require.Equal(t, eventReadsBefore, kvStore.eventsRead(), "enrichment must not look up previous events")
	// One key for the initial RV check, then two for optimistic concurrency control.
	require.Equal(t, 3, kvStore.listed()-listedBefore)

	eventKey, err := backend.eventStore.LastEventKey(ctx)
	require.NoError(t, err)
	event, err := backend.eventStore.Get(ctx, eventKey)
	require.NoError(t, err)
	require.Equal(t, DataActionCreated, event.PreviousAction)
	require.Equal(t, "old-folder", event.PreviousFolder)
}

func TestKvStorageBackend_WriteEvent_PreviousImportedRevision(t *testing.T) {
	for _, compat := range []bool{false, true} {
		name := "sqlkv"
		if compat {
			name = "compat"
		}
		t.Run(name, func(t *testing.T) {
			var backend *kvStorageBackend
			if compat {
				backend, _ = setupCompatSqlKVStorageBackend(t)
			} else {
				backend = setupTestStorageBackend(t, withKV(setupSqlKV(t)))
			}
			ctx := t.Context()
			created := newBulkImportRequest("test-namespace", "item-1", resourcepb.BulkRequest_ADDED)
			updated := newBulkImportRequest("test-namespace", "item-1", resourcepb.BulkRequest_MODIFIED)
			updated.Folder = "imported-folder"
			resp := backend.ProcessBulk(ctx, BulkSettings{
				Collection: []*resourcepb.ResourceKey{{
					Namespace: created.Key.Namespace,
					Group:     created.Key.Group,
					Resource:  created.Key.Resource,
				}},
			}, newBatchOnlyBulkIterator([]*resourcepb.BulkRequest{created, updated}))
			require.Nil(t, resp.Error)
			require.Empty(t, resp.Rejected)
			require.Equal(t, int64(2), resp.Processed)
			_, err := backend.eventStore.LastEventKey(ctx)
			require.ErrorIs(t, err, ErrNotFound, "bulk imports must not emit replayable events")

			key, err := backend.dataStore.GetLatestResourceKey(ctx, GetRequestKey{
				Namespace: updated.Key.Namespace,
				Group:     updated.Key.Group,
				Resource:  updated.Key.Resource,
				Name:      updated.Key.Name,
			})
			require.NoError(t, err)
			obj, err := createTestObject()
			require.NoError(t, err)
			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			meta.SetFolder("new-folder")
			rv, err := backend.WriteEvent(ctx, WriteEvent{
				Type:       resourcepb.WatchEvent_MODIFIED,
				Key:        updated.Key,
				Value:      objectToJSONBytes(t, obj),
				Object:     meta,
				ObjectOld:  meta,
				PreviousRV: key.ResourceVersion,
			})
			require.NoError(t, err)
			eventKey, err := backend.eventStore.LastEventKey(ctx)
			require.NoError(t, err)
			event, err := backend.eventStore.Get(ctx, eventKey)
			require.NoError(t, err)
			require.Equal(t, rv, event.ResourceVersion)
			require.Equal(t, key.ResourceVersion, event.PreviousRV)
			require.Equal(t, DataActionUpdated, event.PreviousAction)
			require.Equal(t, "imported-folder", event.PreviousFolder)
		})
	}
}
