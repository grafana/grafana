package server

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	zStore "github.com/grafana/grafana/pkg/services/authz/zanzana/store"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationServerList(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	server := setupOpenFGAServer(t)
	setup(t, server)
	newList := func(subject, group, resource, subresource string) *authzv1.ListRequest {
		return &authzv1.ListRequest{
			Namespace:   namespace,
			Verb:        utils.VerbList,
			Subject:     subject,
			Group:       group,
			Resource:    resource,
			Subresource: subresource,
		}
	}

	t.Run("user:1 should list resource:dashboard.grafana.app/dashboards/1", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:1", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)
		assert.Equal(t, res.GetItems()[0], "1")
	})

	t.Run("user:2 should be able to list all through group", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:2", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.True(t, res.GetAll())
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 0)
	})

	t.Run("user:3 should be able to list resource:dashboard.grafana.app/dashboards/1 with set relation", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:3", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)

		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)
		assert.Equal(t, res.GetItems()[0], "1")
	})

	t.Run("user:4 should be able to list all dashboard.grafana.app/dashboards in folder 1 and 3", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:4", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 2)

		assert.Contains(t, res.GetFolders(), "1")
		assert.Contains(t, res.GetFolders(), "3")
	})

	t.Run("user:5 should be list all dashboard.grafana.app/dashboards in folder 1 with set relation", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:5", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 1)
		assert.Equal(t, res.GetFolders()[0], "1")
	})

	t.Run("user:6 should be able to list folder 1", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:6", folderGroup, folderResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)
		assert.Equal(t, res.GetItems()[0], "1")
	})

	t.Run("user:7 should be able to list all folders", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:7", folderGroup, folderResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 0)
		assert.True(t, res.GetAll())
	})

	t.Run("user:8 should be able to list resoruce:dashboard.grafana.app/dashboard in folder 6 and folder 5", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:8", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetFolders(), 2)

		assert.Contains(t, res.GetFolders(), "5")
		assert.Contains(t, res.GetFolders(), "6")
	})

	t.Run("user:10 should be able to get resoruce:dashboard.grafana.app/dashboard/status for 10 and 11", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:10", dashboardGroup, dashboardResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetFolders(), 0)
		assert.Len(t, res.GetItems(), 2)

		assert.Contains(t, res.GetItems(), "10")
		assert.Contains(t, res.GetItems(), "11")
	})

	t.Run("user:11 should be able to list all resoruce:dashboard.grafana.app/dashboard/status ", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:11", dashboardGroup, dashboardResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 0)
		assert.True(t, res.GetAll())
	})

	t.Run("user:12 should be able to list all resoruce:dashboard.grafana.app/dashboard/status in folder 5 and 6", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:12", dashboardGroup, dashboardResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 2)

		assert.Contains(t, res.GetFolders(), "5")
		assert.Contains(t, res.GetFolders(), "6")
	})

	t.Run("user:13 should be able to list all subresources in folder 5 and 6", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:13", folderGroup, folderResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 2)
		assert.Len(t, res.GetFolders(), 0)

		assert.Contains(t, res.GetItems(), "5")
		assert.Contains(t, res.GetItems(), "6")
	})

	t.Run("user:14 should be able to list all subresources for team 1", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:14", teamGroup, teamResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)

		assert.Contains(t, res.GetItems(), "1")
	})

	t.Run("user:15 should be able to list all subresources for user 1", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:15", userGroup, userResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)

		assert.Contains(t, res.GetItems(), "1")
	})

	t.Run("user:16 should be able to list all subresources for service-account 1", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:16", serviceAccountGroup, serviceAccountResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)

		assert.Contains(t, res.GetItems(), "1")
	})

	t.Run("user:17 should be able to list all dashboards in folder 4 and all subfolders", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:17", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 3)

		assert.Contains(t, res.GetFolders(), "4")
		assert.Contains(t, res.GetFolders(), "5")
		assert.Contains(t, res.GetFolders(), "6")
	})

	t.Run("user should list dashboard access through teams from request", func(t *testing.T) {
		req := newList("user:contextual", dashboardGroup, dashboardResource, "")
		req.Teams = []string{"ctx-list"}
		res, err := server.List(newContextWithNamespace(), req)
		require.NoError(t, err)
		assert.Contains(t, res.GetItems(), "ctx-list-dashboard")
		assert.NotContains(t, res.GetItems(), "ctx-check-dashboard")
		assert.False(t, res.GetAll())
	})

	t.Run("user should list dashboard access with one thousand request teams", func(t *testing.T) {
		groups := make([]string, 1000)
		for i := range groups {
			groups[i] = fmt.Sprintf("irrelevant-%04d", i)
		}
		groups[999] = "ctx-1000"

		req := newList("user:contextual-1000", dashboardGroup, dashboardResource, "")
		req.Teams = groups
		res, err := server.List(newContextWithNamespace(), req)
		require.NoError(t, err)
		assert.Contains(t, res.GetItems(), "ctx-1000-dashboard")
		assert.False(t, res.GetAll())
	})
}

func TestIntegrationServerListStreaming(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	server := setupOpenFGAServer(t)
	setup(t, server)

	newList := func(subject, group, resource, subresource string) *authzv1.ListRequest {
		return &authzv1.ListRequest{
			Namespace:   namespace,
			Verb:        utils.VerbList,
			Subject:     subject,
			Group:       group,
			Resource:    resource,
			Subresource: subresource,
		}
	}

	t.Run("user:1 should list resource:dashboard.grafana.app/dashboards/1", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:1", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)
		assert.Equal(t, res.GetItems()[0], "1")
	})

	t.Run("user:2 should be able to list all through group", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:2", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.True(t, res.GetAll())
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 0)
	})

	t.Run("user:3 should be able to list resource:dashboard.grafana.app/dashboards/1 with set relation", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:3", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)

		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)
		assert.Equal(t, res.GetItems()[0], "1")
	})

	t.Run("user:4 should be able to list all dashboard.grafana.app/dashboards in folder 1 and 3", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:4", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 2)

		assert.Contains(t, res.GetFolders(), "1")
		assert.Contains(t, res.GetFolders(), "3")
	})

	t.Run("user:5 should be list all dashboard.grafana.app/dashboards in folder 1 with set relation", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:5", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 1)
		assert.Equal(t, res.GetFolders()[0], "1")
	})

	t.Run("user:6 should be able to list folder 1", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:6", folderGroup, folderResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)
		assert.Equal(t, res.GetItems()[0], "1")
	})

	t.Run("user:7 should be able to list all folders", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:7", folderGroup, folderResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 0)
		assert.True(t, res.GetAll())
	})

	t.Run("user:8 should be able to list resoruce:dashboard.grafana.app/dashboard in folder 6 and folder 5", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:8", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetFolders(), 2)

		assert.Contains(t, res.GetFolders(), "5")
		assert.Contains(t, res.GetFolders(), "6")
	})

	t.Run("user:10 should be able to get resoruce:dashboard.grafana.app/dashboard/status for 10 and 11", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:10", dashboardGroup, dashboardResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetFolders(), 0)
		assert.Len(t, res.GetItems(), 2)

		assert.Contains(t, res.GetItems(), "10")
		assert.Contains(t, res.GetItems(), "11")
	})

	t.Run("user:11 should be able to list all resoruce:dashboard.grafana.app/dashboard/status ", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:11", dashboardGroup, dashboardResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 0)
		assert.True(t, res.GetAll())
	})

	t.Run("user:12 should be able to list all resoruce:dashboard.grafana.app/dashboard/status in folder 5 and 6", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:12", dashboardGroup, dashboardResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 2)

		assert.Contains(t, res.GetFolders(), "5")
		assert.Contains(t, res.GetFolders(), "6")
	})

	t.Run("user:13 should be able to list all subresources in folder 5 and 6", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:13", folderGroup, folderResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 2)
		assert.Len(t, res.GetFolders(), 0)

		assert.Contains(t, res.GetItems(), "5")
		assert.Contains(t, res.GetItems(), "6")
	})

	t.Run("user:14 should be able to list all subresources for team 1", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:14", teamGroup, teamResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)

		assert.Contains(t, res.GetItems(), "1")
	})

	t.Run("user:15 should be able to list all subresources for user 1", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:15", userGroup, userResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)

		assert.Contains(t, res.GetItems(), "1")
	})

	t.Run("user:16 should be able to list all subresources for service-account 1", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:16", serviceAccountGroup, serviceAccountResource, statusSubresource))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 1)
		assert.Len(t, res.GetFolders(), 0)

		assert.Contains(t, res.GetItems(), "1")
	})

	t.Run("user:17 should be able to list all dashboards in folder 4 and all subfolders", func(t *testing.T) {
		res, err := server.List(newContextWithNamespace(), newList("user:17", dashboardGroup, dashboardResource, ""))
		require.NoError(t, err)
		assert.Len(t, res.GetItems(), 0)
		assert.Len(t, res.GetFolders(), 3)

		assert.Contains(t, res.GetFolders(), "4")
		assert.Contains(t, res.GetFolders(), "5")
		assert.Contains(t, res.GetFolders(), "6")
	})
}

func TestIntegrationServerListCanceledContext(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	server := setupOpenFGAServer(t)
	setup(t, server)

	newList := func(subject, group, resource string) *authzv1.ListRequest {
		return &authzv1.ListRequest{
			Namespace: namespace,
			Verb:      utils.VerbList,
			Subject:   subject,
			Group:     group,
			Resource:  resource,
		}
	}

	t.Run("canceled context returns an error instead of partial results", func(t *testing.T) {
		ctx := newContextWithNamespace()
		ctx, cancel := context.WithCancel(ctx)
		cancel()

		_, err := server.List(ctx, newList("user:1", dashboardGroup, dashboardResource))
		require.Error(t, err)
	})

	t.Run("expired deadline returns an error instead of partial results", func(t *testing.T) {
		ctx := newContextWithNamespace()
		ctx, cancel := context.WithDeadline(ctx, time.Now().Add(-time.Second))
		defer cancel()

		_, err := server.List(ctx, newList("user:1", dashboardGroup, dashboardResource))
		require.Error(t, err)
	})
}

func TestIntegrationServerListStreamDeadline(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	cfg := setting.NewCfg()
	cfg.ZanzanaServer.ListObjectsDeadline = 1 * time.Nanosecond

	testStore := sqlstore.NewTestStore(t, sqlstore.WithCfg(cfg))

	if testStore.GetDialect().DriverName() == migrator.MySQL {
		if supported, err := testStore.RecursiveQueriesAreSupported(); !supported || err != nil {
			t.Skip("skipping integration test")
		}
	}

	store, err := zStore.NewEmbeddedStore(cfg, testStore, log.NewNopLogger())
	require.NoError(t, err)

	srv, err := NewEmbeddedZanzanaServer(cfg, store, log.NewNopLogger(), tracing.NewNoopTracerService(), prometheus.NewRegistry(), nil, nil, leaderelection.NewDefaultElector())
	require.NoError(t, err)
	t.Cleanup(func() { srv.Close() })

	setup(t, srv)

	newList := func(subject, group, resource string) *authzv1.ListRequest {
		return &authzv1.ListRequest{
			Namespace: namespace,
			Verb:      utils.VerbList,
			Subject:   subject,
			Group:     group,
			Resource:  resource,
		}
	}

	t.Run("stream deadline exceeded returns an error instead of partial results", func(t *testing.T) {
		_, err := srv.List(newContextWithNamespace(), newList("user:1", dashboardGroup, dashboardResource))
		require.Error(t, err)
	})
}

// TestStripHelpersDoNotMutateInput guards the root cause of a cache-poisoning bug: the List
// response strip helpers must return a new slice and never mutate their input, which may be the
// *openfgav1.ListObjectsResponse.Objects slice owned by the query cache. Mutating it in place
// corrupted the cached full object idents that BatchCheck relies on.
func TestStripHelpersDoNotMutateInput(t *testing.T) {
	t.Run("typedObjects", func(t *testing.T) {
		in := []string{"folder:abc", "folder:def"}
		out := typedObjects("folder", in)
		require.Equal(t, []string{"folder:abc", "folder:def"}, in, "input must not be mutated")
		require.Equal(t, []string{"abc", "def"}, out)
	})
	t.Run("genericObjects", func(t *testing.T) {
		in := []string{"resource:dashboard.grafana.app/dashboards/x"}
		out := genericObjects("dashboard.grafana.app/dashboards", in)
		require.Equal(t, []string{"resource:dashboard.grafana.app/dashboards/x"}, in, "input must not be mutated")
		require.Equal(t, []string{"x"}, out)
	})
	t.Run("folderObject", func(t *testing.T) {
		in := []string{"folder:abc", "folder:def"}
		out := folderObject(in)
		require.Equal(t, []string{"folder:abc", "folder:def"}, in, "input must not be mutated")
		require.Equal(t, []string{"abc", "def"}, out)
	})
}

// TestIntegrationListDoesNotPoisonBatchCheckCache reproduces the end-to-end bug: with the query
// cache enabled, a List call must not corrupt the cached ListObjects response that a subsequent
// BatchCheck (identical request) reads, so a directly-granted resource stays authorized.
func TestIntegrationListDoesNotPoisonBatchCheckCache(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	server := setupOpenFGAServer(t)
	setup(t, server)
	server.cfg.CacheSettings.CheckQueryCacheEnabled = true

	ctx := newContextWithNamespace()

	// 1. List populates the ListObjects query cache and strips idents for its own response.
	_, err := server.List(ctx, &authzv1.ListRequest{
		Namespace: namespace, Verb: utils.VerbList, Subject: "user:1",
		Group: dashboardGroup, Resource: dashboardResource,
	})
	require.NoError(t, err)

	// 2. BatchCheck issues the identical ListObjects request (cache hit) and must still resolve
	//    user:1's direct grant on dashboard "1".
	res, err := server.BatchCheck(ctx, &authzv1.BatchCheckRequest{
		Namespace: namespace, Subject: "user:1",
		Checks: []*authzv1.BatchCheckItem{
			{CorrelationId: "c", Verb: utils.VerbGet, Group: dashboardGroup, Resource: dashboardResource, Name: "1", Folder: ""},
		},
	})
	require.NoError(t, err)
	assert.True(t, res.GetResults()["c"].GetAllowed(), "directly-granted dashboard must stay authorized after a prior List")
}
