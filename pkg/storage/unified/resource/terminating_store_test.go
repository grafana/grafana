package resource

import (
	"context"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestTerminatingStore(t *testing.T) {
	testTerminatingStore(t, setupBadgerKV(t))
}

// The SQL KV maps every section to its own table, so a section without one fails only here.
func TestIntegrationTerminatingStoreSQLKV(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	kv, _ := setupSqlKVWithDB(t)
	testTerminatingStore(t, kv)
}

func testTerminatingStore(t *testing.T, kv KV) {
	ctx := t.Context()
	s := newTerminatingStore(kv)

	folderKey := func(ns, name string) *resourcepb.ResourceKey {
		return &resourcepb.ResourceKey{Group: "folder.grafana.app", Resource: "folders", Namespace: ns, Name: name}
	}
	obj := func(terminating bool, finalizers ...string) utils.GrafanaMetaAccessor {
		u := &unstructured.Unstructured{Object: map[string]any{}}
		u.SetFinalizers(finalizers)
		if terminating {
			now := metav1.Now()
			u.SetDeletionTimestamp(&now)
		}
		m, err := utils.MetaAccessor(u)
		require.NoError(t, err)
		return m
	}
	keys := func() []ObjectKey {
		var out []ObjectKey
		for k, err := range s.Keys(ctx, "folder.grafana.app", "folders") {
			require.NoError(t, err)
			out = append(out, k)
		}
		slices.SortFunc(out, func(a, b ObjectKey) int {
			return slices.Compare([]string{a.Namespace, a.Name}, []string{b.Namespace, b.Name})
		})
		return out
	}

	require.NoError(t, s.sync(ctx, folderKey("stacks-1", "a"), DataActionUpdated, obj(true, "f")))
	require.NoError(t, s.sync(ctx, folderKey("stacks-2", "b"), DataActionUpdated, obj(true, "f")))
	require.NoError(t, s.sync(ctx, folderKey("stacks-2", "live"), DataActionUpdated, obj(false, "f")))
	require.Equal(t, []ObjectKey{{"stacks-1", "a"}, {"stacks-2", "b"}}, keys(), "only terminating objects are tracked, across namespaces")

	// Another kind never lands in the section, and doesn't show up in this kind's keys.
	other := &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Namespace: "stacks-1", Name: "d"}
	require.NoError(t, s.sync(ctx, other, DataActionUpdated, obj(true, "f")))
	require.Len(t, keys(), 2)

	// The last finalizer being released clears the hint.
	require.NoError(t, s.sync(ctx, folderKey("stacks-1", "a"), DataActionUpdated, obj(true)))
	require.Equal(t, []ObjectKey{{"stacks-2", "b"}}, keys())

	// A hard delete clears it too.
	require.NoError(t, s.sync(ctx, folderKey("stacks-2", "b"), DataActionDeleted, obj(true, "f")))
	require.Empty(t, keys())
}

func TestServerListTerminating(t *testing.T) {
	ctx := t.Context()
	backend := setupTestStorageBackend(t)
	srv, err := NewResourceServer(ResourceServerOptions{Backend: backend})
	require.NoError(t, err)
	t.Cleanup(func() {
		stopCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		_ = srv.Stop(stopCtx)
	})

	write := func(ns, name string, terminating bool) {
		u := &unstructured.Unstructured{Object: map[string]any{
			"apiVersion": "folder.grafana.app/v1",
			"kind":       "Folder",
			"metadata":   map[string]any{"name": name, "namespace": ns, "uid": name},
		}}
		u.SetFinalizers([]string{"f"})
		if terminating {
			now := metav1.Now()
			u.SetDeletionTimestamp(&now)
		}
		m, err := utils.MetaAccessor(u)
		require.NoError(t, err)
		val, err := u.MarshalJSON()
		require.NoError(t, err)
		_, err = backend.WriteEvent(ctx, WriteEvent{
			Type:  resourcepb.WatchEvent_ADDED,
			Key:   &resourcepb.ResourceKey{Group: "folder.grafana.app", Resource: "folders", Namespace: ns, Name: name},
			Value: val, Object: m,
		})
		require.NoError(t, err)
	}
	write("stacks-1", "gone", true)
	write("stacks-2", "alive", false)

	rsp, err := srv.ListTerminating(ctx, &resourcepb.ListTerminatingRequest{Group: "folder.grafana.app", Resource: "folders"})
	require.NoError(t, err)
	require.Len(t, rsp.Items, 1)
	require.Equal(t, "stacks-1", rsp.Items[0].Namespace)
	require.Equal(t, "gone", rsp.Items[0].Name)

	_, err = srv.ListTerminating(ctx, &resourcepb.ListTerminatingRequest{Group: "folder.grafana.app"})
	require.Equal(t, codes.InvalidArgument, status.Code(err))
}
