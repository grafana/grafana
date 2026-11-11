package search

import (
	"context"
	"fmt"
	"runtime"
	"slices"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var (
	dashboardsGR = schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
	foldersGR    = schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
)

// collectRefs reads the whole enumeration into a name to version map.
func collectRefs(t *testing.T, seq func(func(resource.DocumentRef, error) bool)) map[string]int64 {
	t.Helper()
	out := map[string]int64{}
	for ref, err := range seq {
		require.NoError(t, err)
		out[ref.Name] = ref.RV
	}
	return out
}

func buildRefsIndex(t *testing.T, key resource.NamespacedResource, docs ...*resource.BulkIndexItem) resource.ResourceIndex {
	t.Helper()
	backend, _ := setupBleveBackend(t)
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: key.Namespace})

	index, err := backend.BuildIndex(ctx, key, int64(len(docs)), "test", func(index resource.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&resource.BulkIndexRequest{Items: docs})
	}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(t, err)
	return index
}

func refDoc(gr schema.GroupResource, namespace, name string, rv int64) *resource.BulkIndexItem {
	return &resource.BulkIndexItem{
		Action: resource.ActionIndex,
		Doc: &resource.IndexableDocument{
			RV:    rv,
			Name:  name,
			Title: name,
			Key:   &resourcepb.ResourceKey{Namespace: namespace, Group: gr.Group, Resource: gr.Resource, Name: name},
		},
	}
}

func TestListDocumentRefsOfGlobalIndex(t *testing.T) {
	key := resource.GlobalSearchKey("ns")
	index := buildRefsIndex(t, key,
		refDoc(dashboardsGR, "ns", "dash-a", 11),
		refDoc(dashboardsGR, "ns", "dash-b", 12),
		refDoc(foldersGR, "ns", "folder-a", 13),
	)

	// Each type is enumerated on its own, with the version each document was
	// indexed at.
	assert.Equal(t, map[string]int64{"dash-a": 11, "dash-b": 12},
		collectRefs(t, index.ListDocumentRefs(t.Context(), dashboardsGR)))
	assert.Equal(t, map[string]int64{"folder-a": 13},
		collectRefs(t, index.ListDocumentRefs(t.Context(), foldersGR)))
}

// A type dropped from what the index covers is still listed, so its documents
// can be removed.
func TestListDocumentRefsOfATypeNoLongerCovered(t *testing.T) {
	playlists := schema.GroupResource{Group: "playlist.grafana.app", Resource: "playlists"}
	index := buildRefsIndex(t, resource.GlobalSearchKey("ns"),
		refDoc(dashboardsGR, "ns", "dash-a", 11),
		refDoc(playlists, "ns", "playlist-a", 12),
	)

	assert.Equal(t, map[string]int64{"playlist-a": 12},
		collectRefs(t, index.ListDocumentRefs(t.Context(), playlists)))
}

func TestListDocumentRefsOfPerResourceIndex(t *testing.T) {
	key := resource.NamespacedResource{Namespace: "ns", Group: dashboardsGR.Group, Resource: dashboardsGR.Resource}
	index := buildRefsIndex(t, key,
		refDoc(dashboardsGR, "ns", "dash-a", 11),
		refDoc(dashboardsGR, "ns", "dash-b", 12),
	)

	assert.Equal(t, map[string]int64{"dash-a": 11, "dash-b": 12},
		collectRefs(t, index.ListDocumentRefs(t.Context(), dashboardsGR)))

	// Such an index holds one type, so asking for another is a mistake.
	for _, err := range index.ListDocumentRefs(t.Context(), foldersGR) {
		require.Error(t, err)
		return
	}
	t.Fatal("expected an error")
}

// Every document is returned once, sorted by name, whatever order it was
// written in: reconcile walks the index and storage side by side in name order.
func TestListDocumentRefsAreSortedByName(t *testing.T) {
	names := []string{"d", "a", "e", "a-1", "c", "b"}
	docs := make([]*resource.BulkIndexItem, 0, len(names))
	for i, name := range names {
		docs = append(docs, refDoc(dashboardsGR, "ns", name, int64(10+i)))
	}
	index := buildRefsIndex(t, resource.GlobalSearchKey("ns"), docs...)

	var got []string
	for ref, err := range index.ListDocumentRefs(t.Context(), dashboardsGR) {
		require.NoError(t, err)
		got = append(got, ref.Name)
	}
	assert.Equal(t, []string{"a", "a-1", "b", "c", "d", "e"}, got)
}

// A caller that stops early gets no more references. Every document has been
// read by then: they are read and sorted before the first is returned.
func TestListDocumentRefsStopsWhenTheCallerDoes(t *testing.T) {
	index := buildRefsIndex(t, resource.GlobalSearchKey("ns"),
		refDoc(dashboardsGR, "ns", "dash-a", 11),
		refDoc(dashboardsGR, "ns", "dash-b", 12),
	)

	seen := 0
	for range index.ListDocumentRefs(t.Context(), dashboardsGR) {
		seen++
		break
	}
	assert.Equal(t, 1, seen)
}

// A caller cancelled part way gets an error rather than the rest, so it cannot
// mistake what it saw for every document. That holds wherever it is cancelled,
// including during the last reference.
func TestListDocumentRefsEndsWithAnErrorWhenCancelled(t *testing.T) {
	for _, tc := range []struct {
		docs, cancelAfter int
	}{
		{docs: 2, cancelAfter: 1},
		{docs: 300, cancelAfter: 1},
		{docs: 300, cancelAfter: 290},
		{docs: 300, cancelAfter: 300},
	} {
		t.Run(fmt.Sprintf("%d documents, cancelled after %d", tc.docs, tc.cancelAfter), func(t *testing.T) {
			docs := make([]*resource.BulkIndexItem, 0, tc.docs)
			for i := range tc.docs {
				docs = append(docs, refDoc(dashboardsGR, "ns", fmt.Sprintf("dash-%03d", i), int64(i+1)))
			}
			index := buildRefsIndex(t, resource.GlobalSearchKey("ns"), docs...)

			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			seen := 0
			var last error
			for _, err := range index.ListDocumentRefs(ctx, dashboardsGR) {
				if err != nil {
					last = err
					break
				}
				seen++
				if seen == tc.cancelAfter {
					cancel()
				}
			}
			require.ErrorIs(t, last, context.Canceled)
			assert.Equal(t, tc.cancelAfter, seen)
		})
	}

	t.Run("already cancelled", func(t *testing.T) {
		index := buildRefsIndex(t, resource.GlobalSearchKey("ns"), refDoc(dashboardsGR, "ns", "dash-a", 1))
		ctx, cancel := context.WithCancel(t.Context())
		cancel()
		for ref, err := range index.ListDocumentRefs(ctx, dashboardsGR) {
			require.ErrorIs(t, err, context.Canceled)
			assert.Empty(t, ref.Name)
		}
	})
}

// BenchmarkListDocumentRefs measures reading every document reference of one
// type, as reconcile does, in a global index holding that many dashboards and a
// tenth as many folders, up to the size of the largest namespaces.
//
//	go test ./pkg/storage/unified/search/ -run '^$' -bench BenchmarkListDocumentRefs -benchtime 3x
func BenchmarkListDocumentRefs(b *testing.B) {
	for _, dashboards := range []int{1_000, 10_000, 100_000, 300_000} {
		b.Run(fmt.Sprintf("dashboards=%d", dashboards), func(b *testing.B) {
			index := buildBenchmarkRefsIndex(b, dashboards, dashboards/10)
			b.ReportAllocs()
			var heldPerRef float64
			for b.Loop() {
				b.StopTimer()
				runtime.GC()
				var before runtime.MemStats
				runtime.ReadMemStats(&before)
				b.StartTimer()

				n := 0
				for _, err := range index.ListDocumentRefs(b.Context(), dashboardsGR) {
					require.NoError(b, err)
					if n == 0 {
						// Every reference is held by now, waiting to be handed out.
						b.StopTimer()
						runtime.GC()
						var held runtime.MemStats
						runtime.ReadMemStats(&held)
						if grown := int64(held.HeapAlloc) - int64(before.HeapAlloc); grown > 0 {
							heldPerRef = float64(grown) / float64(dashboards)
						}
						b.StartTimer()
					}
					n++
				}
				require.Equal(b, dashboards, n)
			}
			b.ReportMetric(heldPerRef, "held-bytes/ref")
		})
	}
}

func buildBenchmarkRefsIndex(b *testing.B, dashboards, folders int) resource.ResourceIndex {
	b.Helper()
	key := resource.GlobalSearchKey("default")
	backend, err := NewBleveBackend(BleveOptions{
		Root:          b.TempDir(),
		FileThreshold: 1,
		IndexCacheTTL: time.Hour,
		Logger:        log.NewNopLogger(),
		BuildVersion:  buildVersion,
	}, resource.ProvideIndexMetrics(prometheus.NewRegistry()))
	require.NoError(b, err)
	b.Cleanup(backend.Stop)

	items := make([]*resource.BulkIndexItem, 0, dashboards+folders)
	for i := range dashboards {
		items = append(items, refDoc(dashboardsGR, key.Namespace, fmt.Sprintf("dash-%06d", i), int64(i+1)))
	}
	for i := range folders {
		items = append(items, refDoc(foldersGR, key.Namespace, fmt.Sprintf("folder-%06d", i), int64(i+1)))
	}
	index, err := backend.BuildIndex(b.Context(), key, int64(len(items)), "benchmark", func(index resource.ResourceIndex) (int64, error) {
		for chunk := range slices.Chunk(items, 10_000) {
			if err := index.BulkIndex(&resource.BulkIndexRequest{Items: chunk}); err != nil {
				return 0, err
			}
		}
		return 1, nil
	}, nil, false, time.Time{}, 0, resource.BuildIndexOptions{})
	require.NoError(b, err)
	return index
}
