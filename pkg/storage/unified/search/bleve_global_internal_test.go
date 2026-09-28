package search

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// TestGlobalIndexHoldsSeveralResourceTypes is the end-to-end check for a
// namespace-wide index: documents of more than one resource type go into one
// index, a request naming only the namespace finds all of them, and a request
// can narrow to one type.
func TestGlobalIndexHoldsSeveralResourceTypes(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "default"})
	key := resource.GlobalSearchKey("default")

	doc := func(group, res, name string) *resource.BulkIndexItem {
		return &resource.BulkIndexItem{
			Action: resource.ActionIndex,
			Doc: &resource.IndexableDocument{
				RV:    1,
				Name:  name,
				Key:   &resourcepb.ResourceKey{Namespace: key.Namespace, Group: group, Resource: res, Name: name},
				Title: name,
			},
		}
	}

	index, err := backend.BuildIndex(ctx, key, 3, "test", func(index resource.ResourceIndex) (int64, error) {
		err := index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
			doc("dashboard.grafana.app", "dashboards", "dash-a"),
			doc("dashboard.grafana.app", "dashboards", "dash-b"),
			doc("folder.grafana.app", "folders", "folder-a"),
		}})
		return 1, err
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	access := NewStubAccessClient(map[string]bool{"dashboards": true, "folders": true})
	search := func(fields ...*resourcepb.Requirement) []string {
		rsp, err := index.Search(ctx, access, &resourcepb.ResourceSearchRequest{
			// Only the namespace: a namespace-wide index is not asked for one type.
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: key.Namespace},
				Fields: fields,
			},
			Limit: 100,
		}, nil, nil)
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		names := make([]string, 0, len(rsp.Results.Rows))
		for _, row := range rsp.Results.Rows {
			names = append(names, row.Key.Name)
		}
		return names
	}

	t.Run("a request without a type filter finds every type", func(t *testing.T) {
		assert.ElementsMatch(t, []string{"dash-a", "dash-b", "folder-a"}, search())
	})

	t.Run("a request can narrow to one type", func(t *testing.T) {
		assert.ElementsMatch(t, []string{"folder-a"}, search(&resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_GROUP_RESOURCE,
			Operator: string(selection.Equals),
			Values:   []string{"folder.grafana.app/folders"},
		}))
	})

	t.Run("a request can name several exact types", func(t *testing.T) {
		assert.ElementsMatch(t, []string{"dash-a", "dash-b", "folder-a"}, search(&resourcepb.Requirement{
			Key:      resource.SEARCH_FIELD_GROUP_RESOURCE,
			Operator: string(selection.In),
			Values:   []string{"dashboard.grafana.app/dashboards", "folder.grafana.app/folders"},
		}))
	})

	t.Run("a hit is authorized against its own resource type", func(t *testing.T) {
		// Permission on folders alone leaves the dashboards out, even though they
		// share the index.
		foldersOnly := NewStubAccessClient(map[string]bool{"folders": true})
		rsp, err := index.Search(ctx, foldersOnly, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Namespace: key.Namespace}},
			Limit:   100,
		}, nil, nil)
		require.NoError(t, err)
		require.Nil(t, rsp.Error)

		names := make([]string, 0, len(rsp.Results.Rows))
		for _, row := range rsp.Results.Rows {
			names = append(names, row.Key.Name)
		}
		assert.ElementsMatch(t, []string{"folder-a"}, names)
	})

	t.Run("each hit keeps its own resource type", func(t *testing.T) {
		rsp, err := index.Search(ctx, access, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Namespace: key.Namespace}},
			Limit:   100,
		}, nil, nil)
		require.NoError(t, err)
		require.Nil(t, rsp.Error)

		found := map[string]string{}
		for _, row := range rsp.Results.Rows {
			found[row.Key.Name] = row.Key.Group + "/" + row.Key.Resource
		}
		assert.Equal(t, map[string]string{
			"dash-a":   "dashboard.grafana.app/dashboards",
			"dash-b":   "dashboard.grafana.app/dashboards",
			"folder-a": "folder.grafana.app/folders",
		}, found)
	})
}

func TestVerifyKeyPerResourceIndex(t *testing.T) {
	idx := &bleveIndex{key: resource.NamespacedResource{
		Namespace: "ns",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}}

	require.Nil(t, idx.verifyKey(&resourcepb.ResourceKey{
		Namespace: "ns",
		Group:     "dashboard.grafana.app",
		Resource:  "dashboards",
	}))

	for _, tc := range []struct {
		name string
		key  *resourcepb.ResourceKey
	}{
		{"other namespace", &resourcepb.ResourceKey{Namespace: "other", Group: "dashboard.grafana.app", Resource: "dashboards"}},
		{"other group", &resourcepb.ResourceKey{Namespace: "ns", Group: "folder.grafana.app", Resource: "dashboards"}},
		{"other resource", &resourcepb.ResourceKey{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "folders"}},
		{"namespace only", &resourcepb.ResourceKey{Namespace: "ns"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.NotNil(t, idx.verifyKey(tc.key))
		})
	}
}

func TestVerifyKeyGlobalIndex(t *testing.T) {
	idx := &bleveIndex{key: resource.GlobalSearchKey("ns")}
	require.True(t, idx.key.IsGlobal())

	// A namespace-wide index holds several resource types, so a request only has to
	// name the namespace, and a request naming one of the covered types is fine too.
	for _, tc := range []struct {
		name string
		key  *resourcepb.ResourceKey
	}{
		{"namespace only", &resourcepb.ResourceKey{Namespace: "ns"}},
		{"dashboards", &resourcepb.ResourceKey{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"}},
		{"folders", &resourcepb.ResourceKey{Namespace: "ns", Group: "folder.grafana.app", Resource: "folders"}},
		{"the global pair itself", &resourcepb.ResourceKey{Namespace: "ns", Group: resource.GlobalSearchGroup, Resource: resource.GlobalSearchResource}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Nil(t, idx.verifyKey(tc.key))
		})
	}

	// Namespace isolation still applies.
	assert.NotNil(t, idx.verifyKey(&resourcepb.ResourceKey{Namespace: "other"}))
}

func TestGlobalIndexSearchFields(t *testing.T) {
	global := newKindSearchFields(nil, resource.GlobalSearchGroup, resource.GlobalSearchResource, nil)
	perResource := newKindSearchFields(nil, "dashboard.grafana.app", "dashboards", nil)

	// The resource type is filterable, under the one name it has.
	f, ok := global.keywordFields[resource.SEARCH_FIELD_GROUP_RESOURCE]
	require.True(t, ok)
	assert.True(t, f.filterable)
	assert.Equal(t, resource.SEARCH_FIELD_GROUP_RESOURCE, f.name)

	_, ok = perResource.keywordFields[resource.SEARCH_FIELD_GROUP_RESOURCE]
	assert.False(t, ok, "the resource type must stay unavailable to per-resource search")

	// Timestamps are sortable here and nowhere else.
	for _, name := range []string{resource.SEARCH_FIELD_CREATED, resource.SEARCH_FIELD_UPDATED} {
		assert.True(t, global.sortableFields[name], name)
		assert.False(t, perResource.sortableFields[name], name)
	}

	// A namespace-wide index holds no deleted documents, so it does not offer the
	// fields only a deleted document carries.
	for _, def := range resource.TrashSearchFieldDefinitions() {
		_, ok := global.resultFields[def.Name]
		assert.False(t, ok, def.Name)
		_, ok = perResource.resultFields[def.Name]
		assert.True(t, ok, def.Name)
	}
}

func TestGlobalSearchKeyIsDistinct(t *testing.T) {
	global := resource.GlobalSearchKey("ns")
	require.True(t, global.Valid(), "the reserved pair must be non-empty to work as a cache key")

	dashboards := resource.NamespacedResource{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"}
	assert.False(t, dashboards.IsGlobal())
	assert.NotEqual(t, global, dashboards)

	// The reserved pair must not collide with a real resource on disk or in remote
	// storage, because both derive their path from the key.
	assert.NotEqual(t, resourceSubPath(global), resourceSubPath(dashboards))
}
