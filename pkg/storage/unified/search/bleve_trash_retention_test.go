package search_test

import (
	"context"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
)

// Trash for an object garbage collection has already taken, or is about to, is a
// restore offer that cannot be honoured. These cover which of those the index
// still returns.
func TestTrashRetentionWindow(t *testing.T) {
	const day = 24 * time.Hour

	// Deleted well before any window used here, and well after.
	old := time.Now().Add(-30 * day).UnixMilli()
	recent := time.Now().Add(-1 * time.Hour).UnixMilli()

	for _, tc := range []struct {
		name      string
		group     string
		resource  string
		retention search.TrashRetentionConfig
		want      []string
	}{
		{
			// The case most likely to be got wrong: with collection off nothing is
			// ever removed, so a year-old deletion is still fully restorable and
			// hiding it would lose the user their object.
			name:      "collection disabled returns trash of any age",
			group:     "dashboard.grafana.app",
			resource:  "dashboards",
			retention: search.TrashRetentionConfig{Enabled: false, MaxAge: day, DashboardsMaxAge: day},
			want:      []string{"no-timestamp", "old", "recent"},
		},
		{
			name:      "collection enabled hides expired trash",
			group:     "dashboard.grafana.app",
			resource:  "dashboards",
			retention: search.TrashRetentionConfig{Enabled: true, MaxAge: day, DashboardsMaxAge: day},
			want:      []string{"no-timestamp", "recent"},
		},
		{
			// Dashboards keep their trash far longer than everything else, so the
			// window has to be per kind rather than one number.
			name:      "dashboards use their own longer window",
			group:     "dashboard.grafana.app",
			resource:  "dashboards",
			retention: search.TrashRetentionConfig{Enabled: true, MaxAge: time.Hour, DashboardsMaxAge: 365 * day},
			want:      []string{"no-timestamp", "old", "recent"},
		},
		{
			// The collector computes the same cutoff from a zero window and removes
			// everything older, so search has to hide the same set.
			name:      "a zero window expires everything with a deletion time",
			group:     "dashboard.grafana.app",
			resource:  "dashboards",
			retention: search.TrashRetentionConfig{Enabled: true},
			want:      []string{"no-timestamp"},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			index := newTrashRetentionIndex(t, tc.group, tc.resource, tc.retention, old, recent)

			req := &resourcepb.ResourceSearchRequest{
				Options:   &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Group: tc.group, Resource: tc.resource, Namespace: "default"}},
				Limit:     10,
				IsDeleted: true,
			}
			res, err := index.Search(context.Background(), nil, req, nil, nil)
			require.NoError(t, err)
			require.Nil(t, res.Error)

			got := make([]string, 0, len(res.Results.Rows))
			for _, row := range res.Results.Rows {
				got = append(got, row.Key.Name)
			}
			require.ElementsMatch(t, tc.want, got)
		})
	}
}

// A live search must be unaffected by the window: live documents carry no
// deletion time, and excluding them would empty the index for every caller.
func TestTrashRetentionLeavesLiveSearchAlone(t *testing.T) {
	index := newTrashRetentionIndex(t, "dashboard.grafana.app", "dashboards",
		search.TrashRetentionConfig{Enabled: true, MaxAge: time.Hour, DashboardsMaxAge: time.Hour},
		time.Now().Add(-30*24*time.Hour).UnixMilli(), time.Now().UnixMilli())

	req := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Group: "dashboard.grafana.app", Resource: "dashboards", Namespace: "default"}},
		Limit:   10,
	}
	res, err := index.Search(context.Background(), nil, req, nil, nil)
	require.NoError(t, err)
	require.Nil(t, res.Error)

	got := make([]string, 0, len(res.Results.Rows))
	for _, row := range res.Results.Rows {
		got = append(got, row.Key.Name)
	}
	require.Equal(t, []string{"live"}, got)
}

// newTrashRetentionIndex builds an index holding one live document and three
// deleted ones: expired, recent, and one with no deletion time at all, which is
// what a marker without a deletion timestamp produces.
func newTrashRetentionIndex(t testing.TB, group, res string, retention search.TrashRetentionConfig, old, recent int64) resource.ResourceIndex {
	t.Helper()

	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: 5,
		SearchFields: resource.NewSearchFieldsRegistry(nil, nil, map[resource.LowerGroupResource]resource.SearchFieldsProvider{
			resource.NewLowerGroupResource(group, res): search.DashboardSearchFieldsProviderForTest(),
		}),
		TrashRetention: retention,
	}, nil)
	require.NoError(t, err)
	t.Cleanup(backend.Stop)

	key := resource.NamespacedResource{Namespace: "default", Group: group, Resource: res}
	deleted := func(name string, at *int64, rv int64) *resource.BulkIndexItem {
		rvs := strconv.FormatInt(rv, 10)
		doc := &resource.IndexableDocument{
			Key:       &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: name},
			Name:      name,
			Title:     name,
			RV:        rv,
			IsDeleted: ptr(true),
			DeletedRV: &rvs,
		}
		doc.DeletionTime = at
		return &resource.BulkIndexItem{Action: resource.ActionIndex, Doc: doc}
	}

	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})
	index, err := backend.BuildIndex(ctx, key, 4, "test", func(i resource.ResourceIndex) (int64, error) {
		return 1, i.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
			deleted("old", &old, 10),
			deleted("recent", &recent, 20),
			deleted("no-timestamp", nil, 30),
			{Action: resource.ActionIndex, Doc: &resource.IndexableDocument{
				Key:   &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "live"},
				Name:  "live",
				Title: "live",
			}},
		}})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	return index
}

func ptr[T any](v T) *T { return &v }
