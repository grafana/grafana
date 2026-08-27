package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/google/uuid"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource/lease"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
	"github.com/stretchr/testify/require"
)

// partialDeleteKV simulates a partial chunked delete: the first data-section BatchDelete
// deletes only its first key and then returns an error; later calls delegate fully. GC
// deletes oldest-first, so the deletion marker (highest RV) is last and survives the
// partial failure — the next GC pass must re-find it and finish.
type partialDeleteKV struct {
	KV
	failedOnce bool
}

func (p *partialDeleteKV) BatchDelete(ctx context.Context, section string, keys []string) error {
	if !p.failedOnce && section == dataSection && len(keys) > 1 {
		p.failedOnce = true
		if err := p.KV.BatchDelete(ctx, section, keys[:1]); err != nil {
			return err
		}
		return errors.New("simulated partial batch delete failure")
	}
	return p.KV.BatchDelete(ctx, section, keys)
}

// writeEventOption is a function that modifies writeEventOptions
type writeEventOption func(*writeEventOptions)

type writeEventOptions struct {
	Namespace  string
	Group      string
	Resource   string
	Folder     string
	Value      []byte
	PreviousRV int64
}

func writeEvent(t *testing.T, ctx context.Context, storageBackend *kvStorageBackend, resourceName string, action resourcepb.WatchEvent_Type, opts ...writeEventOption) (int64, error) {
	// Default options
	options := writeEventOptions{
		Namespace: "namespace",
		Group:     "group",
		Resource:  "resource",
		Folder:    "folderuid",
	}

	// Apply options
	for _, opt := range opts {
		opt(&options)
	}

	u := unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": options.Group + "/v1",
			"kind":       options.Resource,
			"metadata": map[string]any{
				"name":      resourceName,
				"namespace": options.Namespace,
			},
			"spec": map[string]any{
				"value": resourceName + " " + resourcepb.WatchEvent_Type_name[int32(action)],
			},
		},
	}
	value, err := u.MarshalJSON()
	require.NoError(t, err)

	res := &unstructured.Unstructured{
		Object: map[string]any{},
	}
	meta, err := utils.MetaAccessor(res)
	require.NoError(t, err)
	meta.SetFolder(options.Folder)

	event := WriteEvent{
		Type:  action,
		Value: value,
		GUID:  uuid.New().String(),
		Key: &resourcepb.ResourceKey{
			Namespace: options.Namespace,
			Group:     options.Group,
			Resource:  options.Resource,
			Name:      resourceName,
		},
		PreviousRV: options.PreviousRV,
	}

	switch action {
	case resourcepb.WatchEvent_DELETED:
		event.ObjectOld = meta

		obj, err := utils.MetaAccessor(res)
		if err != nil {
			return 0, err
		}
		now := metav1.Now()
		obj.SetDeletionTimestamp(&now)
		obj.SetUpdatedTimestamp(&now.Time)
		obj.SetManagedFields(nil)
		obj.SetFinalizers(nil)
		obj.SetGeneration(utils.DeletedGeneration)
		obj.SetAnnotation(utils.AnnoKeyKubectlLastAppliedConfig, "") // clears it
		event.Object = obj
	case resourcepb.WatchEvent_ADDED:
		event.Object = meta
	case resourcepb.WatchEvent_MODIFIED:
		event.Object = meta //
		event.ObjectOld = meta
	default:
		panic(fmt.Sprintf("invalid action: %s", action))
	}

	return storageBackend.WriteEvent(ctx, event)
}

func TestIntegrationGarbageCollectionGroupResource(t *testing.T) {
	gcConfig := GarbageCollectionConfig{
		Enabled:          true,
		DryRun:           false,
		Interval:         time.Minute,
		BatchSize:        100,
		DashboardsMaxAge: 24 * time.Hour,
	}

	t.Run("can garbage collect a deleted resource", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)

		ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

		storageBackend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
			opts.GarbageCollection = gcConfig
		})
		b := storageBackend

		server, err := NewResourceServer(ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_ = server.Stop(ctx)
		})

		rv1, err := writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)

		_, err = writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) {
				o.PreviousRV = rv1
			})
		require.NoError(t, err)

		listResp, err := server.List(ctx, &resourcepb.ListRequest{
			Source: resourcepb.ListRequest_STORE,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Empty(t, listResp.Items)

		cutoffTimestamp := b.garbageCollectionCutoffTimestamp("group", "resource", time.Now().Add(time.Hour).UnixMicro()) // Everything eligible for deletion
		err = b.garbageCollectGroupResource(ctx, "group", "resource", cutoffTimestamp)
		require.NoError(t, err)

		// count how many history entries there are after GC runs - should be 0
		historyResp := storageBackend.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: "group/resource/namespace/",
			EndKey:   "group/resource/namespace0",
		})
		count := 0
		historyResp(func(k string, err error) bool {
			require.NoError(t, err)
			count++
			return true
		})
		require.Equal(t, 0, count)
	})

	t.Run("will only garbage collect eligible resources before cutoff", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)

		ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

		storageBackend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
			opts.GarbageCollection = gcConfig
		})
		b := storageBackend

		server, err := NewResourceServer(ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_ = server.Stop(ctx)
		})

		rv1, err := writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		rv2, err := writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) {
				o.PreviousRV = rv1
			})
		require.NoError(t, err)

		rv3, err := writeEvent(t, ctx, storageBackend, "resource2", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = writeEvent(t, ctx, storageBackend, "resource2", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) {
				o.PreviousRV = rv3
			})
		require.NoError(t, err)

		cutoffTimestamp := b.garbageCollectionCutoffTimestamp("group", "resource", rv2+1)
		err = b.garbageCollectGroupResource(ctx, "group", "resource", cutoffTimestamp)
		require.NoError(t, err)

		historyResp, err := server.List(ctx, &resourcepb.ListRequest{
			Source: resourcepb.ListRequest_HISTORY,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
					Name:      "resource1",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, historyResp.Error)
		require.Len(t, historyResp.Items, 0)

		historyResp, err = server.List(ctx, &resourcepb.ListRequest{
			Source: resourcepb.ListRequest_TRASH,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
					Name:      "resource2",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, historyResp.Error)
		require.Len(t, historyResp.Items, 1)
	})

	t.Run("will not delete rows for other eligible resources", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)

		ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

		storageBackend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
			opts.GarbageCollection = gcConfig
		})
		b := storageBackend

		server, err := NewResourceServer(ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_ = server.Stop(ctx)
		})

		rv1, err := writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) {
				o.PreviousRV = rv1
			})
		require.NoError(t, err)

		rv2, err := writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED,
			func(o *writeEventOptions) {
				o.Resource = "other-resource"
			})
		require.NoError(t, err)
		_, err = writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) {
				o.PreviousRV = rv2
				o.Resource = "other-resource"
			})
		require.NoError(t, err)

		cutoffTimestamp := b.garbageCollectionCutoffTimestamp("group", "resource", time.Now().Add(time.Hour).UnixMicro()) // everything eligible for deletion
		err = b.garbageCollectGroupResource(ctx, "group", "resource", cutoffTimestamp)
		require.NoError(t, err)

		historyResp, err := server.List(ctx, &resourcepb.ListRequest{
			Source: resourcepb.ListRequest_HISTORY,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
					Name:      "resource1",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, historyResp.Error)
		require.Len(t, historyResp.Items, 0)

		trashResp, err := server.List(ctx, &resourcepb.ListRequest{
			Source: resourcepb.ListRequest_TRASH,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "other-resource",
					Name:      "resource1",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, trashResp.Error)
		require.Len(t, trashResp.Items, 1)
	})

	t.Run("will delete resources in multiple batches", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)

		ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

		storageBackend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
			opts.GarbageCollection = gcConfig
		})
		b := storageBackend

		server, err := NewResourceServer(ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_ = server.Stop(ctx)
		})

		rv1, err := writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) {
				o.PreviousRV = rv1
			})
		require.NoError(t, err)

		rv2, err := writeEvent(t, ctx, storageBackend, "resource2", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = writeEvent(t, ctx, storageBackend, "resource2", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) {
				o.PreviousRV = rv2
			})
		require.NoError(t, err)

		trashResp, err := server.List(ctx, &resourcepb.ListRequest{
			Source: resourcepb.ListRequest_TRASH,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, trashResp.Error)
		require.Len(t, trashResp.Items, 2)

		cutoffTimestamp := b.garbageCollectionCutoffTimestamp("group", "resource", time.Now().Add(time.Hour).UnixMicro()) // everything eligible for deletion
		b.garbageCollection.BatchSize = 1
		err = b.garbageCollectGroupResource(ctx, "group", "resource", cutoffTimestamp)
		require.NoError(t, err)

		trashResp, err = server.List(ctx, &resourcepb.ListRequest{
			Source: resourcepb.ListRequest_TRASH,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, trashResp.Error)
		require.Empty(t, trashResp.Items)
	})

	t.Run("will delete rows from before the resource gets deleted, but it will keep rows from after the resource gets recreated with same name", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)

		ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

		storageBackend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
			opts.GarbageCollection = gcConfig
		})
		b := storageBackend

		server, err := NewResourceServer(ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_ = server.Stop(ctx)
		})

		rv1, err := writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)

		_, err = writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) {
				o.PreviousRV = rv1
			})
		require.NoError(t, err)

		_, err = writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)

		cutoffTimestamp := b.garbageCollectionCutoffTimestamp("group", "resource", time.Now().Add(time.Hour).UnixMicro()) // everything eligible for deletion
		err = b.garbageCollectGroupResource(ctx, "group", "resource", cutoffTimestamp)
		require.NoError(t, err)

		historyResp, err := server.List(ctx, &resourcepb.ListRequest{
			Source: resourcepb.ListRequest_HISTORY,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
					Name:      "resource1",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, historyResp.Error)
		require.Len(t, historyResp.Items, 1)
	})

	t.Run("pagination does not delete resources that were recreated", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)

		ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

		cfg := gcConfig
		cfg.BatchSize = 3
		storageBackend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
			opts.GarbageCollection = cfg
		})
		b := storageBackend

		// other-dash: 2 keys (created, deleted)
		rv1, err := writeEvent(t, ctx, storageBackend, "other-dash", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = writeEvent(t, ctx, storageBackend, "other-dash", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) { o.PreviousRV = rv1 })
		require.NoError(t, err)

		// my-dash: 5 keys (created, updated, deleted, created again and updated again) — first batch ends with a my-dash key
		rv1, err = writeEvent(t, ctx, storageBackend, "my-dash", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		rv2, err := writeEvent(t, ctx, storageBackend, "my-dash", resourcepb.WatchEvent_MODIFIED,
			func(o *writeEventOptions) { o.PreviousRV = rv1 })
		require.NoError(t, err)
		_, err = writeEvent(t, ctx, storageBackend, "my-dash", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) { o.PreviousRV = rv2 })
		require.NoError(t, err)
		rv4, err := writeEvent(t, ctx, storageBackend, "my-dash", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = writeEvent(t, ctx, storageBackend, "my-dash", resourcepb.WatchEvent_MODIFIED,
			func(o *writeEventOptions) { o.PreviousRV = rv4 })
		require.NoError(t, err)

		cutoffTimestamp := b.garbageCollectionCutoffTimestamp("group", "resource", time.Now().Add(time.Hour).UnixMicro())
		err = b.garbageCollectGroupResource(ctx, "group", "resource", cutoffTimestamp)
		require.NoError(t, err)

		// other-dash was deleted and not recreated: all of its history is removed.
		// my-dash still exists (recreated after delete); GC skips deleting its history when
		// GetLatestResourceKey succeeds, so all five revision keys remain.
		// BatchSize=3 exercises pagination across both resources without dropping my-dash history.
		historyResp := storageBackend.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: "group/resource/namespace/",
			EndKey:   "group/resource/namespace0",
		})
		count := 0
		historyResp(func(k string, err error) bool {
			require.NoError(t, err)
			require.Contains(t, k, "/my-dash/")
			require.NotContains(t, k, "/other-dash/")
			count++
			return true
		})
		require.Equal(t, 5, count)
	})
}

func TestIntegrationGarbageCollectionLoop(t *testing.T) {
	gcConfig := GarbageCollectionConfig{
		Enabled:          true,
		Interval:         time.Minute,
		BatchSize:        100,
		DashboardsMaxAge: 24 * time.Hour,
	}

	t.Run("can delete eligble resources", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)

		ctx := testutil.NewTestContext(t, time.Now().Add(2*time.Minute))

		storageBackend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
			opts.GarbageCollection = gcConfig
		})
		b := storageBackend

		server, err := NewResourceServer(ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_ = server.Stop(ctx)
		})

		rv1, err := writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) {
				o.PreviousRV = rv1
			})
		require.NoError(t, err)

		// count how many history entries there are before GC runs - should be 2 (created and deleted)
		historyResp := storageBackend.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: "group/resource/namespace/",
			EndKey:   "group/resource/namespace0",
		})
		count := 0
		historyResp(func(k string, err error) bool {
			require.NoError(t, err)
			count++
			return true
		})
		require.Equal(t, 2, count)

		cutoffTimestamp := time.Now().Add(time.Hour).UnixMicro() // everything eligible for deletion
		b.runGarbageCollection(ctx, cutoffTimestamp)

		// count how many history entries there are after GC runs - should be 0
		historyResp = storageBackend.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: "group/resource/namespace/",
			EndKey:   "group/resource/namespace0",
		})
		count = 0
		historyResp(func(k string, err error) bool {
			require.NoError(t, err)
			count++
			return true
		})
		require.Equal(t, 0, count)
	})

	t.Run("nothing is eligble to delete", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)

		ctx := testutil.NewTestContext(t, time.Now().Add(2*time.Minute))

		storageBackend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
			opts.GarbageCollection = gcConfig
		})
		b := storageBackend

		server, err := NewResourceServer(ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_ = server.Stop(ctx)
		})

		rv1, err := writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) {
				o.PreviousRV = rv1
			})
		require.NoError(t, err)

		// count how many history entries there are before GC runs - should be 2 (created and deleted)
		historyResp := storageBackend.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: "group/resource/namespace/",
			EndKey:   "group/resource/namespace0",
		})
		count := 0
		historyResp(func(k string, err error) bool {
			require.NoError(t, err)
			count++
			return true
		})
		require.Equal(t, 2, count)

		cutoffTimestamp := time.Now().Add(-time.Hour).UnixMicro() // nothing eligible for deletion
		b.runGarbageCollection(ctx, cutoffTimestamp)

		// count how many history entries there are after GC runs - should still be 2
		historyResp = storageBackend.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: "group/resource/namespace/",
			EndKey:   "group/resource/namespace0",
		})
		count = 0
		historyResp(func(k string, err error) bool {
			require.NoError(t, err)
			count++
			return true
		})
		require.Equal(t, 2, count)
	})

	t.Run("will respect dashboard retention settings", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)

		ctx := testutil.NewTestContext(t, time.Now().Add(2*time.Minute))

		storageBackend := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
			opts.GarbageCollection = gcConfig
		})
		b := storageBackend

		server, err := NewResourceServer(ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_ = server.Stop(ctx)
		})

		rv1, err := writeEvent(t, ctx, storageBackend, "dashboard1", resourcepb.WatchEvent_ADDED,
			func(o *writeEventOptions) {
				o.Group = "dashboard.grafana.app"
				o.Resource = "dashboards"
			})
		require.NoError(t, err)
		_, err = writeEvent(t, ctx, storageBackend, "dashboard1", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) {
				o.Namespace = "namespace"
				o.PreviousRV = rv1
				o.Group = "dashboard.grafana.app"
				o.Resource = "dashboards"
			})
		require.NoError(t, err)

		rv2, err := writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) {
				o.PreviousRV = rv2
			})
		require.NoError(t, err)

		cutoffTimestamp := time.Now().Add(1 * time.Hour).UnixMicro() // everything eligible for deletion (except dashboards)
		b.runGarbageCollection(ctx, cutoffTimestamp)

		// count how many history entries there are for group/resource - should be 0 (they were deleted by GC)
		historyResp := storageBackend.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: "group/resource/",
			EndKey:   "group/resource0",
		})
		count := 0
		historyResp(func(k string, err error) bool {
			require.NoError(t, err)
			count++
			return true
		})
		require.Equal(t, 0, count)

		// count how many history entries there are for dashboard.grafana.app/dashboards - should be 2 (created and deleted)
		historyResp = storageBackend.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: "dashboard.grafana.app/dashboards/",
			EndKey:   "dashboard.grafana.app/dashboards0",
		})
		count = 0
		historyResp(func(k string, err error) bool {
			require.NoError(t, err)
			count++
			return true
		})
		require.Equal(t, 2, count)

		trashResp, err := server.List(ctx, &resourcepb.ListRequest{
			Source: resourcepb.ListRequest_TRASH,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "namespace",
					Group:     "dashboard.grafana.app",
					Resource:  "dashboards",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, trashResp.Error)
		require.Len(t, trashResp.Items, 1)
	})
}

func TestIntegrationGarbageCollectionPartialDeleteConverges(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

	wrapped := &partialDeleteKV{KV: setupBadgerKV(t)}
	b := setupTestStorageBackend(t, func(opts *KVBackendOptions) {
		opts.GarbageCollection = GarbageCollectionConfig{
			Enabled: true, DryRun: false, Interval: time.Minute, BatchSize: 100, DashboardsMaxAge: 24 * time.Hour,
		}
		opts.KvStore = wrapped
	})

	// One resource, several revisions ending in a deletion.
	rv1, err := writeEvent(t, ctx, b, "resource1", resourcepb.WatchEvent_ADDED)
	require.NoError(t, err)
	rv2, err := writeEvent(t, ctx, b, "resource1", resourcepb.WatchEvent_MODIFIED,
		func(o *writeEventOptions) { o.PreviousRV = rv1 })
	require.NoError(t, err)
	_, err = writeEvent(t, ctx, b, "resource1", resourcepb.WatchEvent_DELETED,
		func(o *writeEventOptions) { o.PreviousRV = rv2 })
	require.NoError(t, err)

	countHistory := func() int {
		it := b.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: "group/resource/namespace/",
			EndKey:   "group/resource/namespace0",
		})
		count := 0
		it(func(_ string, err error) bool {
			require.NoError(t, err)
			count++
			return true
		})
		return count
	}

	cutoff := b.garbageCollectionCutoffTimestamp("group", "resource", time.Now().Add(time.Hour).UnixMicro())

	initial := countHistory()
	require.Equal(t, 3, initial, "expected 3 history revisions before GC")

	// First pass fails mid-delete. It must delete something (partial progress) yet leave
	// the deletion marker (deleted last) behind.
	err = b.garbageCollectGroupResource(ctx, "group", "resource", cutoff)
	require.Error(t, err)
	require.True(t, wrapped.failedOnce, "partial delete was not exercised")
	afterPartial := countHistory()
	require.Less(t, afterPartial, initial, "partial delete should have removed at least one revision")
	require.Greater(t, afterPartial, 0, "partial failure should leave the deletion marker behind")

	// Second pass (no injected failure) re-finds the marker and finishes.
	err = b.garbageCollectGroupResource(ctx, "group", "resource", cutoff)
	require.NoError(t, err)
	require.Equal(t, 0, countHistory(), "GC did not converge after a partial delete")
}

// TestIntegrationGarbageCollectionLock verifies the best-effort singleton
// lock that ensures only one storage-api replica runs a GC cycle at a time,
// built on the same lease primitive used for usage-stats flushing and
// search snapshot build/cleanup locks.
func TestIntegrationGarbageCollectionLock(t *testing.T) {
	gcConfig := GarbageCollectionConfig{
		Enabled:          true,
		Interval:         time.Minute,
		BatchSize:        100,
		DashboardsMaxAge: 24 * time.Hour,
	}

	countHistoryEntries := func(t *testing.T, ctx context.Context, b *kvStorageBackend) int {
		count := 0
		resp := b.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: "group/resource/namespace/",
			EndKey:   "group/resource/namespace0",
		})
		resp(func(k string, err error) bool {
			require.NoError(t, err)
			count++
			return true
		})
		return count
	}

	setupBackendWithHistory := func(t *testing.T, configs ...func(*KVBackendOptions)) (*kvStorageBackend, context.Context) {
		ctx := testutil.NewTestContext(t, time.Now().Add(2*time.Minute))

		storageBackend := setupTestStorageBackend(t, append([]func(*KVBackendOptions){func(opts *KVBackendOptions) {
			opts.GarbageCollection = gcConfig
		}}, configs...)...)

		server, err := NewResourceServer(ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)
		t.Cleanup(func() {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			_ = server.Stop(ctx)
		})

		rv1, err := writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = writeEvent(t, ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED,
			func(o *writeEventOptions) {
				o.PreviousRV = rv1
			})
		require.NoError(t, err)
		require.Equal(t, 2, countHistoryEntries(t, ctx, storageBackend))

		return storageBackend, ctx
	}

	withKVLeases := func(opts *KVBackendOptions) {
		opts.EnableKVLeases = true
		opts.Holder = "test-holder"
	}

	t.Run("skips the cycle when another replica holds the lock", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)

		b, ctx := setupBackendWithHistory(t, withKVLeases)

		// Simulate another replica that is already running a GC cycle.
		l, err := b.leaseManager.Acquire(ctx, gcLeaseName, lease.WithTTL(gcLeaseTTL))
		require.NoError(t, err)
		t.Cleanup(func() { _ = b.leaseManager.Release(ctx, l) })

		cutoffTimestamp := time.Now().Add(time.Hour).UnixMicro() // everything eligible for deletion
		b.runGarbageCollectionWithLock(ctx, cutoffTimestamp)

		// GC must have been skipped: history entries remain untouched.
		require.Equal(t, 2, countHistoryEntries(t, ctx, b))
	})

	t.Run("runs and releases the lock when no other replica holds it", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)

		b, ctx := setupBackendWithHistory(t, withKVLeases)

		cutoffTimestamp := time.Now().Add(time.Hour).UnixMicro() // everything eligible for deletion
		b.runGarbageCollectionWithLock(ctx, cutoffTimestamp)

		require.Equal(t, 0, countHistoryEntries(t, ctx, b))

		// the lock must be released so a future cycle isn't skipped forever
		l, err := b.leaseManager.Acquire(ctx, gcLeaseName, lease.WithTTL(gcLeaseTTL))
		require.NoError(t, err)
		require.NoError(t, b.leaseManager.Release(ctx, l))
	})

	t.Run("runs on every replica when leases are disabled", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)

		b, ctx := setupBackendWithHistory(t)
		require.Nil(t, b.leaseManager)

		cutoffTimestamp := time.Now().Add(time.Hour).UnixMicro() // everything eligible for deletion
		b.runGarbageCollectionWithLock(ctx, cutoffTimestamp)

		require.Equal(t, 0, countHistoryEntries(t, ctx, b))
	})
}

// blockOnFirstDataKeysKV blocks the first Keys call against dataSection made
// after arm() until release is closed, letting a test pause a GC cycle
// mid-flight without also blocking on Keys calls made during test setup.
type blockOnFirstDataKeysKV struct {
	KV
	armed   atomic.Bool
	once    sync.Once
	release chan struct{}
	blocked chan struct{}
}

func (w *blockOnFirstDataKeysKV) arm() {
	w.armed.Store(true)
}

func (w *blockOnFirstDataKeysKV) Keys(ctx context.Context, section string, opt ListOptions) iter.Seq2[string, error] {
	if section == dataSection && w.armed.Load() {
		w.once.Do(func() {
			close(w.blocked)
			<-w.release
		})
	}
	return w.KV.Keys(ctx, section, opt)
}

// TestIntegrationGarbageCollectionLockCancelsOnLeaseLoss verifies that a GC
// cycle stops once its auto-renewed lease is lost to another replica,
// instead of continuing to delete under a context nobody still owns the lock for.
func TestIntegrationGarbageCollectionLockCancelsOnLeaseLoss(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	// 10s is the lease package's minimum allowed TTL (lease.Manager.minTTL);
	// renewInterval = ttl/3, so replica-a's next renewal attempt lands ~3.3s in.
	origTTL := gcLeaseTTL
	gcLeaseTTL = 10 * time.Second
	t.Cleanup(func() { gcLeaseTTL = origTTL })

	ctx := testutil.NewTestContext(t, time.Now().Add(2*time.Minute))

	wrapped := &blockOnFirstDataKeysKV{KV: setupBadgerKV(t), release: make(chan struct{}), blocked: make(chan struct{})}
	b := setupTestStorageBackend(t, withKV(wrapped), func(opts *KVBackendOptions) {
		opts.GarbageCollection = GarbageCollectionConfig{
			Enabled: true, Interval: time.Minute, BatchSize: 100, DashboardsMaxAge: 24 * time.Hour,
		}
		opts.EnableKVLeases = true
		opts.Holder = "replica-a"
	})

	rv1, err := writeEvent(t, ctx, b, "resource1", resourcepb.WatchEvent_ADDED)
	require.NoError(t, err)
	_, err = writeEvent(t, ctx, b, "resource1", resourcepb.WatchEvent_DELETED,
		func(o *writeEventOptions) { o.PreviousRV = rv1 })
	require.NoError(t, err)

	countHistory := func() int {
		count := 0
		b.kv.Keys(ctx, dataSection, ListOptions{
			StartKey: "group/resource/namespace/",
			EndKey:   "group/resource/namespace0",
		})(func(_ string, err error) bool {
			require.NoError(t, err)
			count++
			return true
		})
		return count
	}
	require.Equal(t, 2, countHistory())

	wrapped.arm()
	done := make(chan struct{})
	go func() {
		defer close(done)
		cutoffTimestamp := time.Now().Add(time.Hour).UnixMicro() // everything eligible for deletion
		b.runGarbageCollectionWithLock(ctx, cutoffTimestamp)
	}()

	select {
	case <-wrapped.blocked:
	case <-time.After(5 * time.Second):
		t.Fatal("GC cycle never called Keys(dataSection); block point not reached")
	}

	// Steal the lease out from under replica-a using a clock-skewed manager,
	// mirroring how the lease package's own renewal-loss tests force a steal.
	stealer := lease.NewManager(wrapped, "replica-b", nil,
		lease.WithGarbageCollectionDisabled,
		lease.WithInternalNowFunc(func() time.Time { return time.Now().Add(time.Hour) }),
	)
	require.Eventually(t, func() bool {
		l, err := stealer.Acquire(ctx, gcLeaseName, lease.WithTTL(gcLeaseTTL))
		if err != nil {
			return false
		}
		t.Cleanup(func() { _ = stealer.Release(ctx, l) })
		return true
	}, time.Second, 10*time.Millisecond, "replica-b never stole the GC lease")

	// Give replica-a's auto-renew loop time to discover the theft and cancel.
	time.Sleep(5 * time.Second)
	close(wrapped.release)

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("runGarbageCollectionWithLock did not return after lease loss")
	}

	// The cycle must have stopped before deleting anything once its context
	// was cancelled by the lost lease.
	require.Equal(t, 2, countHistory())
}
