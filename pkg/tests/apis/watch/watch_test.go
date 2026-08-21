package watch

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"

	"github.com/grafana/grafana/pkg/tests/apis"
	"github.com/grafana/grafana/pkg/tests/testinfra"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

var gvr = schema.GroupVersionResource{
	Group:    "playlist.grafana.app",
	Version:  "v1",
	Resource: "playlists",
}

// newClient starts Grafana with the KV backend (the one that can replay events)
// and returns a playlists client.
func newClient(t *testing.T) *apis.K8sResourceClient {
	t.Helper()
	helper := apis.NewK8sTestHelper(t, testinfra.GrafanaOpts{
		AppModeProduction:  true,
		DisableAnonymous:   true,
		EnableSQLKVBackend: true,
	})
	return helper.GetResourceClient(apis.ResourceClientArgs{
		User: helper.Org1.Admin,
		GVR:  gvr,
	})
}

func createPlaylist(t *testing.T, client *apis.K8sResourceClient, name string) *unstructured.Unstructured {
	t.Helper()
	created, err := client.Resource.Create(context.Background(), &unstructured.Unstructured{
		Object: map[string]any{
			"apiVersion": gvr.GroupVersion().String(),
			"kind":       "Playlist",
			"metadata":   map[string]any{"name": name},
			"spec": map[string]any{
				"title":    name,
				"interval": "5m",
				"items":    []any{},
			},
		},
	}, metav1.CreateOptions{})
	require.NoError(t, err)
	return created
}

// TestIntegrationWatchResumesFromResourceVersion checks that a watch resuming
// from a resource version is delivered every write that happened while the
// client was disconnected, replayed from the event store in resource-version
// order.
func TestIntegrationWatchResumesFromResourceVersion(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	client := newClient(t)
	ctx := context.Background()

	list, err := client.Resource.List(ctx, metav1.ListOptions{})
	require.NoError(t, err)
	resumeFrom := list.GetResourceVersion()

	// Writes that happen while the client is "disconnected". They all predate the
	// watch below, so they can only reach it through the event-store replay.
	const writes = 550
	for i := range writes {
		createPlaylist(t, client, fmt.Sprintf("missed-%03d", i))
	}

	w, err := client.Resource.Watch(ctx, metav1.ListOptions{ResourceVersion: resumeFrom})
	require.NoError(t, err)
	defer w.Stop()

	// Every missed write must be delivered, in resource-version order, starting
	// with the oldest (missed-000) - none may be skipped.
	deadline := time.After(30 * time.Second)
	for i := range writes {
		select {
		case evt, ok := <-w.ResultChan():
			require.True(t, ok, "watch closed after %d of %d missed writes", i, writes)
			require.NotEqual(t, watch.Error, evt.Type, "unexpected error event: %v", evt.Object)
			obj, ok := evt.Object.(*unstructured.Unstructured)
			require.True(t, ok, "unexpected object type %T", evt.Object)
			require.Equal(t, fmt.Sprintf("missed-%03d", i), obj.GetName(),
				"missed writes delivered out of order or skipped")
		case <-deadline:
			t.Fatalf("timed out after %d of %d missed writes", i, writes)
		}
	}
}
