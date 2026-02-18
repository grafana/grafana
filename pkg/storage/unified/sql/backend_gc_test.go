package sql

import (
	"testing"
	"time"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	test "github.com/grafana/grafana/pkg/storage/unified/testing"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	sqldb "github.com/grafana/grafana/pkg/storage/unified/sql/db"
	"github.com/grafana/grafana/pkg/storage/unified/sql/db/dbimpl"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationGarbageCollectionBatch(t *testing.T) {
	gcConfig := GarbageCollectionConfig{
		Enabled:          true,
		Interval:         time.Minute,
		BatchSize:        100,
		DashboardsMaxAge: 24 * time.Hour,
	}
	t.Run("can garbage collect a deleted resource", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)
		t.Cleanup(db.CleanupTestDB)

		ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

		storageBackend, _ := newTestBackend(t, gcConfig)
		b := storageBackend.(*backend)

		server, err := resource.NewResourceServer(resource.ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)

		rv1, err := test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)

		_, err = test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED, test.WithNamespaceAndRV("namespace", rv1))
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
		require.Equal(t, 0, len(listResp.Items))

		cutoffTimestamp := time.Now().Add(time.Hour).UnixMicro() // Everything eligible for deletion
		rowsDeleted, err := b.garbageCollectBatch(ctx, "group", "resource", cutoffTimestamp, 100)
		require.NoError(t, err)
		require.Equal(t, int64(2), rowsDeleted)

		historyResp, err := server.List(ctx, &resourcepb.ListRequest{
			Source: resourcepb.ListRequest_HISTORY,
			Options: &resourcepb.ListOptions{
				Key: &resourcepb.ResourceKey{
					Namespace: "namespace",
					Group:     "group",
					Resource:  "resource",
				},
			},
		})
		require.NoError(t, err)
		require.Nil(t, historyResp.Error)
		require.Len(t, historyResp.Items, 0)
	})

	t.Run("will only garbage collect eligible resources before cutoff", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)
		t.Cleanup(db.CleanupTestDB)

		ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

		storageBackend, _ := newTestBackend(t, gcConfig)
		b := storageBackend.(*backend)

		server, err := resource.NewResourceServer(resource.ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)

		rv1, err := test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		rv2, err := test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED, test.WithNamespaceAndRV("namespace", rv1))
		require.NoError(t, err)

		rv3, err := test.WriteEvent(ctx, storageBackend, "resource2", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = test.WriteEvent(ctx, storageBackend, "resource2", resourcepb.WatchEvent_DELETED, test.WithNamespaceAndRV("namespace", rv3))
		require.NoError(t, err)

		cutoffTimestamp := rv2 + 1
		rowsDeleted, err := b.garbageCollectBatch(ctx, "group", "resource", cutoffTimestamp, 100)
		require.NoError(t, err)
		require.Equal(t, int64(2), rowsDeleted)

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
		t.Cleanup(db.CleanupTestDB)

		ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

		storageBackend, _ := newTestBackend(t, gcConfig)
		b := storageBackend.(*backend)

		server, err := resource.NewResourceServer(resource.ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)

		rv1, err := test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED, test.WithNamespaceAndRV("namespace", rv1))
		require.NoError(t, err)

		rv2, err := test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED, test.WithResource("other-resource"))
		require.NoError(t, err)
		_, err = test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED, test.WithNamespaceAndRV("namespace", rv2), test.WithResource("other-resource"))
		require.NoError(t, err)

		cutoffTimestamp := time.Now().Add(time.Hour).UnixMicro() // everything eligible for deletion
		rowsDeleted, err := b.garbageCollectBatch(ctx, "group", "resource", cutoffTimestamp, 100)
		require.NoError(t, err)
		require.Equal(t, int64(2), rowsDeleted)

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

	t.Run("will limit candidate batch size", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)
		t.Cleanup(db.CleanupTestDB)

		ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

		storageBackend, _ := newTestBackend(t, gcConfig)
		b := storageBackend.(*backend)

		server, err := resource.NewResourceServer(resource.ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)

		rv1, err := test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED, test.WithNamespaceAndRV("namespace", rv1))
		require.NoError(t, err)

		rv2, err := test.WriteEvent(ctx, storageBackend, "resource2", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = test.WriteEvent(ctx, storageBackend, "resource2", resourcepb.WatchEvent_DELETED, test.WithNamespaceAndRV("namespace", rv2))
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

		cutoffTimestamp := time.Now().Add(time.Hour).UnixMicro() // everything eligible for deletion
		rowsDeleted, err := b.garbageCollectBatch(ctx, "group", "resource", cutoffTimestamp, 1)
		require.NoError(t, err)
		require.Equal(t, int64(2), rowsDeleted)

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
		require.Len(t, trashResp.Items, 1)
	})

	t.Run("will not delete rows when resource is deleted then recreated with same name", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)
		t.Cleanup(db.CleanupTestDB)

		ctx := testutil.NewTestContext(t, time.Now().Add(30*time.Second))

		storageBackend, _ := newTestBackend(t, gcConfig)
		b := storageBackend.(*backend)

		server, err := resource.NewResourceServer(resource.ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)

		rv1, err := test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)

		_, err = test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED, test.WithNamespaceAndRV("namespace", rv1))
		require.NoError(t, err)

		_, err = test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED, test.WithNamespace("namespace"))
		require.NoError(t, err)

		cutoffTimestamp := time.Now().Add(time.Hour).UnixMicro() // everything eligible for deletion
		rowsDeleted, err := b.garbageCollectBatch(ctx, "group", "resource", cutoffTimestamp, 100)
		require.NoError(t, err)
		require.Equal(t, int64(0), rowsDeleted)

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
		t.Cleanup(db.CleanupTestDB)

		ctx := testutil.NewTestContext(t, time.Now().Add(2*time.Minute))

		storageBackend, _ := newTestBackend(t, gcConfig)
		b := storageBackend.(*backend)

		_, err := resource.NewResourceServer(resource.ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)

		rv1, err := test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED, test.WithNamespaceAndRV("namespace", rv1))
		require.NoError(t, err)

		cutoffTimestamp := time.Now().Add(time.Hour).UnixMicro() // everything eligible for deletion
		results := b.runGarbageCollection(ctx, cutoffTimestamp)
		require.NoError(t, err)
		require.Equal(t, int64(2), results["group/resource"])
	})

	t.Run("will respect dashboard retention settings", func(t *testing.T) {
		testutil.SkipIntegrationTestInShortMode(t)
		t.Cleanup(db.CleanupTestDB)

		ctx := testutil.NewTestContext(t, time.Now().Add(2*time.Minute))

		storageBackend, _ := newTestBackend(t, gcConfig)
		b := storageBackend.(*backend)

		server, err := resource.NewResourceServer(resource.ResourceServerOptions{
			Backend: storageBackend,
		})
		require.NoError(t, err)

		rv1, err := test.WriteEvent(ctx, storageBackend, "dashboard1", resourcepb.WatchEvent_ADDED,
			test.WithGroup("dashboard.grafana.app"),
			test.WithResource("dashboards"))
		require.NoError(t, err)
		_, err = test.WriteEvent(ctx, storageBackend, "dashboard1", resourcepb.WatchEvent_DELETED,
			test.WithNamespaceAndRV("namespace", rv1),
			test.WithGroup("dashboard.grafana.app"),
			test.WithResource("dashboards"))
		require.NoError(t, err)

		rv2, err := test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_ADDED)
		require.NoError(t, err)
		_, err = test.WriteEvent(ctx, storageBackend, "resource1", resourcepb.WatchEvent_DELETED, test.WithNamespaceAndRV("namespace", rv2))
		require.NoError(t, err)

		cutoffTimestamp := time.Now().Add(1 * time.Hour).UnixMicro() // everything eligible for deletion (except dashboards)
		results := b.runGarbageCollection(ctx, cutoffTimestamp)
		require.Equal(t, int64(2), results["group/resource"])
		require.Zero(t, results["dashboard.grafana.app/dashboards"])

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

func newTestBackend(t *testing.T, gcConfig GarbageCollectionConfig) (resource.StorageBackend, sqldb.DB) {
	dbstore := db.InitTestDB(t)
	eDB, err := dbimpl.ProvideResourceDB(dbstore, setting.NewCfg(), nil)
	require.NoError(t, err)
	require.NotNil(t, eDB)

	backend, err := NewBackend(BackendOptions{
		DBProvider:           eDB,
		IsHA:                 false,
		LastImportTimeMaxAge: 24 * time.Hour,
		GarbageCollection:    gcConfig,
	})
	require.NoError(t, err)
	require.NotNil(t, backend)
	ctx := testutil.NewTestContext(t, time.Now().Add(1*time.Minute))
	svc, ok := backend.(services.Service)
	require.True(t, ok)
	require.NoError(t, services.StartAndAwaitRunning(ctx, svc))

	sqlDB, err := eDB.Init(testutil.NewTestContext(t, time.Now().Add(1*time.Minute)))
	require.NoError(t, err)

	return backend, sqlDB
}
