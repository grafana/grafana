package search

import (
	"strconv"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// What the pass removes, and more importantly what it leaves alone: deleting from
// an index cannot be undone without a rebuild.
func TestRemoveExpiredTrash(t *testing.T) {
	const day = 24 * time.Hour

	old := time.Now().Add(-30 * day).UnixMilli()
	recent := time.Now().Add(-1 * time.Hour).UnixMilli()

	for _, tc := range []struct {
		name      string
		retention TrashRetentionConfig
		// Names the index still holds after the pass, trash and live together.
		want []string
	}{
		{
			// Nothing expires with collection off, so all of this is still restorable.
			name:      "collection disabled removes nothing",
			retention: TrashRetentionConfig{Enabled: false, MaxAge: day, DashboardsMaxAge: day},
			want:      []string{"live", "old-live", "no-timestamp", "old", "recent"},
		},
		{
			name:      "expired trash is removed and the rest is kept",
			retention: TrashRetentionConfig{Enabled: true, MaxAge: day, DashboardsMaxAge: day},
			want:      []string{"live", "old-live", "no-timestamp", "recent"},
		},
		{
			// Dashboards keep trash far longer, so nothing here has expired yet.
			name:      "dashboards use their own longer window",
			retention: TrashRetentionConfig{Enabled: true, MaxAge: time.Hour, DashboardsMaxAge: 365 * day},
			want:      []string{"live", "old-live", "no-timestamp", "old", "recent"},
		},
		{
			// The collector computes the same cutoff from a zero window and removes
			// everything, so the index has to as well.
			name:      "a zero window removes all trash carrying a deletion time",
			retention: TrashRetentionConfig{Enabled: true},
			want:      []string{"live", "old-live", "no-timestamp"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			backend, idx := newTrashCleanupIndex(t, tc.retention, old, recent)

			backend.RemoveExpiredTrash(t.Context())

			require.ElementsMatch(t, tc.want, allDocumentIDs(t, idx))
		})
	}
}

// An index that has just started keeping trash can hold a large backlog, so one
// pass has to drain past a single batch.
func TestRemoveExpiredTrashDrainsMoreThanOneBatch(t *testing.T) {
	backend, err := NewBleveBackend(BleveOptions{
		Root:           t.TempDir(),
		FileThreshold:  5,
		SearchFields:   trashCleanupSearchFields(),
		TrashRetention: TrashRetentionConfig{Enabled: true, MaxAge: time.Hour, DashboardsMaxAge: time.Hour},
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	expired := time.Now().Add(-30 * 24 * time.Hour).UnixMilli()
	total := trashCleanupBatchSize + 10

	key := trashCleanupKey()
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "ns"})
	index, err := backend.BuildIndex(ctx, key, int64(total), "test", func(i resource.ResourceIndex) (int64, error) {
		items := make([]*resource.BulkIndexItem, 0, total)
		for n := range total {
			items = append(items, deletedTrashItem(key, "trash-"+strconv.Itoa(n), &expired, int64(n+1)))
		}
		return 1, i.BulkIndex(&resource.BulkIndexRequest{Items: items})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	backend.RemoveExpiredTrash(t.Context())

	require.Empty(t, allDocumentIDs(t, index))
}

// newTrashCleanupIndex builds an index holding two live documents, one older than
// any window used here, and three deleted ones: expired, recent, and one with no
// deletion time, as written before that field existed.
func newTrashCleanupIndex(t testing.TB, retention TrashRetentionConfig, old, recent int64) (*bleveBackend, resource.ResourceIndex) {
	t.Helper()

	backend, err := NewBleveBackend(BleveOptions{
		Root:           t.TempDir(),
		FileThreshold:  5,
		SearchFields:   trashCleanupSearchFields(),
		TrashRetention: retention,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	key := trashCleanupKey()
	live := func(name string, rv int64) *resource.BulkIndexItem {
		return &resource.BulkIndexItem{Action: resource.ActionIndex, Doc: &resource.IndexableDocument{
			Key:   &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: name},
			Name:  name,
			Title: name,
			RV:    rv,
		}}
	}

	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "ns"})
	index, err := backend.BuildIndex(ctx, key, 4, "test", func(i resource.ResourceIndex) (int64, error) {
		return 1, i.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
			deletedTrashItem(key, "old", &old, 10),
			deletedTrashItem(key, "recent", &recent, 20),
			deletedTrashItem(key, "no-timestamp", nil, 30),
			live("live", 40),
			// Age alone must not get a live document removed.
			live("old-live", 1),
		}})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	return backend, index
}

func trashCleanupKey() resource.NamespacedResource {
	return resource.NamespacedResource{Namespace: "default", Group: dashboardGroup, Resource: dashboardResource}
}

func trashCleanupSearchFields() *resource.SearchFieldsRegistry {
	return resource.NewSearchFieldsRegistry(nil, nil, map[resource.LowerGroupResource]resource.SearchFieldsProvider{
		resource.NewLowerGroupResource(dashboardGroup, dashboardResource): DashboardSearchFieldsProviderForTest(),
	})
}

func deletedTrashItem(key resource.NamespacedResource, name string, deletedAt *int64, rv int64) *resource.BulkIndexItem {
	rvs := strconv.FormatInt(rv, 10)
	deleted := true
	return &resource.BulkIndexItem{Action: resource.ActionIndex, Doc: &resource.IndexableDocument{
		Key:          &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: name},
		Name:         name,
		Title:        name,
		RV:           rv,
		IsDeleted:    &deleted,
		DeletedRV:    &rvs,
		DeletionTime: deletedAt,
	}}
}

// allDocumentIDs returns every document in the index, trash included, so a test
// can tell removal from the read path merely hiding something.
func allDocumentIDs(t testing.TB, index resource.ResourceIndex) []string {
	t.Helper()

	idx, ok := index.(*bleveIndex)
	require.True(t, ok)

	names := []string{}
	docs, err := idx.index.DocCount()
	require.NoError(t, err)
	if docs == 0 {
		return names
	}

	res, err := idx.index.Search(bleve.NewSearchRequestOptions(bleve.NewMatchAllQuery(), int(docs), 0, false))
	require.NoError(t, err)
	for _, hit := range res.Hits {
		k := &resourcepb.ResourceKey{}
		require.NoError(t, resource.ReadSearchID(k, hit.ID))
		names = append(names, k.Name)
	}
	return names
}
