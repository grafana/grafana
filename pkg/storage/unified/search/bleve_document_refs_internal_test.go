package search

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	}, nil, false, time.Time{}, 0)
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

func TestListDocumentRefsRejectsAnUncoveredType(t *testing.T) {
	index := buildRefsIndex(t, resource.GlobalSearchKey("ns"), refDoc(dashboardsGR, "ns", "dash-a", 11))

	playlists := schema.GroupResource{Group: "playlist.grafana.app", Resource: "playlists"}
	for _, err := range index.ListDocumentRefs(t.Context(), playlists) {
		require.Error(t, err, "a type this index does not cover is a mistake, not an empty answer")
		return
	}
	t.Fatal("expected an error")
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

// Every document is returned, whatever the page size, and none twice.
func TestListDocumentRefsPages(t *testing.T) {
	original := listDocumentRefsPageSize
	listDocumentRefsPageSize = 2
	t.Cleanup(func() { listDocumentRefsPageSize = original })

	docs := make([]*resource.BulkIndexItem, 0, 5)
	want := map[string]int64{}
	for i, name := range []string{"a", "b", "c", "d", "e"} {
		rv := int64(10 + i)
		docs = append(docs, refDoc(dashboardsGR, "ns", name, rv))
		want[name] = rv
	}

	index := buildRefsIndex(t, resource.GlobalSearchKey("ns"), docs...)

	got := map[string]int64{}
	count := 0
	for ref, err := range index.ListDocumentRefs(t.Context(), dashboardsGR) {
		require.NoError(t, err)
		got[ref.Name] = ref.RV
		count++
	}
	assert.Equal(t, want, got)
	assert.Equal(t, len(want), count, "no document is returned twice")
}

// Stopping early has to stop the reads too, so a caller that has seen enough
// does not pay for the rest.
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
