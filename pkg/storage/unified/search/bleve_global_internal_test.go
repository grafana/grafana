package search

import (
	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"

	searchmodel "github.com/grafana/grafana/pkg/storage/unified/search/model"

	"errors"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// TestGlobalIndexHoldsSeveralResourceTypes is the end-to-end check for a
// namespace-wide index: documents of more than one resource type go into one
// index, a request naming only the namespace finds all of them, and a request
// can narrow to one type.
func TestGlobalIndexHoldsSeveralResourceTypes(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "default"})
	key := resourcecontract.GlobalSearchKey("default")

	doc := func(group, res, name string) *searchmodel.BulkIndexItem {
		return &searchmodel.BulkIndexItem{
			Action: searchmodel.ActionIndex,
			Doc: &searchmodel.IndexableDocument{
				RV:    1,
				Name:  name,
				Key:   &resourcepb.ResourceKey{Namespace: key.Namespace, Group: group, Resource: res, Name: name},
				Title: name,
			},
		}
	}

	index, err := backend.BuildIndex(ctx, key, 3, "test", func(index searchmodel.ResourceIndex) (int64, error) {
		err := index.BulkIndex(&searchmodel.BulkIndexRequest{Items: []*searchmodel.BulkIndexItem{
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
			Key:      searchmodel.SEARCH_FIELD_GROUP_RESOURCE,
			Operator: string(selection.Equals),
			Values:   []string{"folder.grafana.app/folders"},
		}))
	})

	t.Run("a request can name several exact types", func(t *testing.T) {
		assert.ElementsMatch(t, []string{"dash-a", "dash-b", "folder-a"}, search(&resourcepb.Requirement{
			Key:      searchmodel.SEARCH_FIELD_GROUP_RESOURCE,
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
	idx := &bleveIndex{key: resourcecontract.NamespacedResource{
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
	idx := &bleveIndex{key: resourcecontract.GlobalSearchKey("ns")}
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
		{"the global pair itself", &resourcepb.ResourceKey{Namespace: "ns", Group: resourcecontract.GlobalSearchGroup, Resource: resourcecontract.GlobalSearchResource}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			assert.Nil(t, idx.verifyKey(tc.key))
		})
	}

	// Namespace isolation still applies.
	assert.NotNil(t, idx.verifyKey(&resourcepb.ResourceKey{Namespace: "other"}))
}

func TestGlobalIndexSearchFields(t *testing.T) {
	global := newKindSearchFields(nil, resourcecontract.GlobalSearchGroup, resourcecontract.GlobalSearchResource, nil)
	perResource := newKindSearchFields(nil, "dashboard.grafana.app", "dashboards", nil)

	// The resource type is filterable, under the one name it has.
	f, ok := global.keywordFields[searchmodel.SEARCH_FIELD_GROUP_RESOURCE]
	require.True(t, ok)
	assert.True(t, f.filterable)
	assert.Equal(t, searchmodel.SEARCH_FIELD_GROUP_RESOURCE, f.name)

	_, ok = perResource.keywordFields[searchmodel.SEARCH_FIELD_GROUP_RESOURCE]
	assert.False(t, ok, "the resource type must stay unavailable to per-resource search")

	// Timestamps are sortable here and nowhere else.
	for _, name := range []string{searchmodel.SEARCH_FIELD_CREATED, searchmodel.SEARCH_FIELD_UPDATED} {
		assert.True(t, global.sortableFields[name], name)
		assert.False(t, perResource.sortableFields[name], name)
	}

	// A namespace-wide index holds no deleted documents, so it does not offer the
	// fields only a deleted document carries.
	for _, def := range searchmodel.TrashSearchFieldDefinitions() {
		_, ok := global.resultFields[def.Name]
		assert.False(t, ok, def.Name)
		_, ok = perResource.resultFields[def.Name]
		assert.True(t, ok, def.Name)
	}
}

func TestGlobalSearchKeyIsDistinct(t *testing.T) {
	global := resourcecontract.GlobalSearchKey("ns")
	require.True(t, global.Valid(), "the reserved pair must be non-empty to work as a cache key")

	dashboards := resourcecontract.NamespacedResource{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"}
	assert.False(t, dashboards.IsGlobal())
	assert.NotEqual(t, global, dashboards)

	// The reserved pair must not collide with a real resource on disk or in remote
	// storage, because both derive their path from the key.
	assert.NotEqual(t, resourceSubPath(global), resourceSubPath(dashboards))
}

// Two resource types can hold the same name, so on a namespace-wide index the
// name alone does not order results. Paging one at a time has to return each
// document exactly once.
func TestGlobalIndexPagesThroughSameNamedDocuments(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "default"})
	key := resourcecontract.GlobalSearchKey("default")

	doc := func(group, res, name string) *searchmodel.BulkIndexItem {
		return &searchmodel.BulkIndexItem{
			Action: searchmodel.ActionIndex,
			Doc: &searchmodel.IndexableDocument{
				RV:    1,
				Name:  name,
				Title: name,
				Key:   &resourcepb.ResourceKey{Namespace: key.Namespace, Group: group, Resource: res, Name: name},
			},
		}
	}
	index, err := backend.BuildIndex(ctx, key, 3, "test", func(index searchmodel.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&searchmodel.BulkIndexRequest{Items: []*searchmodel.BulkIndexItem{
			doc("dashboard.grafana.app", "dashboards", "shared"),
			doc("folder.grafana.app", "folders", "shared"),
			doc("dashboard.grafana.app", "dashboards", "zzz"),
		}})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	access := NewStubAccessClient(map[string]bool{"dashboards": true, "folders": true})
	var seen []string
	var after []string
	for range 5 {
		rsp, err := index.Search(ctx, access, &resourcepb.ResourceSearchRequest{
			Options:     &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Namespace: key.Namespace}},
			SortBy:      []*resourcepb.ResourceSearchRequest_Sort{{Field: searchmodel.SEARCH_FIELD_NAME}},
			Limit:       1,
			SearchAfter: after,
		}, nil, nil)
		require.NoError(t, err)
		require.Nil(t, rsp.Error)
		if len(rsp.Results.Rows) == 0 {
			break
		}
		row := rsp.Results.Rows[0]
		seen = append(seen, row.Key.Group+"/"+row.Key.Resource+"/"+row.Key.Name)
		after = row.SortFields
	}

	assert.ElementsMatch(t, []string{
		"dashboard.grafana.app/dashboards/shared",
		"folder.grafana.app/folders/shared",
		"dashboard.grafana.app/dashboards/zzz",
	}, seen)
	assert.Len(t, seen, 3, "no document is repeated")
}

var (
	typeBuildsKey = resourcecontract.NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
	importedA     = schema.GroupResource{Group: "a.grafana.app", Resource: "as"}
	importedB     = schema.GroupResource{Group: "b.grafana.app", Resource: "bs"}
	importMonday  = time.Date(2026, 9, 28, 10, 0, 0, 123456789, time.UTC)
)

func TestCompletedTypeBuildsAreEmptyOnANewIndex(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	idx, err := backend.BuildIndex(t.Context(), typeBuildsKey, 1, "test", indexTestDocs(typeBuildsKey, 1, 100), nil, false, time.Time{}, 0)
	require.NoError(t, err)

	builds, err := idx.CompletedTypeBuilds()
	require.NoError(t, err)
	assert.Empty(t, builds)
}

// Recording one type keeps what is recorded for the others, to the nanosecond.
func TestCompletedTypeBuildsAreRecordedPerType(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	idx, err := backend.BuildIndex(t.Context(), typeBuildsKey, 1, "test", indexTestDocs(typeBuildsKey, 1, 100), nil, false, time.Time{}, 0)
	require.NoError(t, err)

	require.NoError(t, idx.RecordCompletedTypeBuild(importedA, searchmodel.TypeBuild{StorageImportTime: importMonday}))
	require.NoError(t, idx.RecordCompletedTypeBuild(importedB, searchmodel.TypeBuild{StorageImportTime: importMonday.Add(time.Hour)}))
	require.NoError(t, idx.RecordCompletedTypeBuild(importedA, searchmodel.TypeBuild{StorageImportTime: importMonday.Add(2 * time.Hour)}))

	builds, err := idx.CompletedTypeBuilds()
	require.NoError(t, err)
	assert.Equal(t, map[schema.GroupResource]searchmodel.TypeBuild{
		importedA: {StorageImportTime: importMonday.Add(2 * time.Hour)},
		importedB: {StorageImportTime: importMonday.Add(time.Hour)},
	}, builds)
}

// A type the index holds but never saw imported is recorded with the zero time,
// and a forgotten type is no longer recorded at all.
func TestCompletedTypeBuildsRecordNeverImportedAndForgottenTypes(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	idx, err := backend.BuildIndex(t.Context(), typeBuildsKey, 1, "test", indexTestDocs(typeBuildsKey, 1, 100), nil, false, time.Time{}, 0)
	require.NoError(t, err)

	require.NoError(t, idx.RecordCompletedTypeBuild(importedA, searchmodel.TypeBuild{}))
	require.NoError(t, idx.RecordCompletedTypeBuild(importedB, searchmodel.TypeBuild{StorageImportTime: importMonday}))
	builds, err := idx.CompletedTypeBuilds()
	require.NoError(t, err)
	assert.Equal(t, map[schema.GroupResource]searchmodel.TypeBuild{importedA: {}, importedB: {StorageImportTime: importMonday}}, builds)

	require.NoError(t, idx.ForgetType(importedB))
	builds, err = idx.CompletedTypeBuilds()
	require.NoError(t, err)
	assert.Equal(t, map[schema.GroupResource]searchmodel.TypeBuild{importedA: {}}, builds)
}

// A type is recorded as it is first written, and a delete does not forget it:
// only ForgetType does, after its documents are removed. Kept inside the index,
// so a restarted server still finds a type written in part.
func TestDocumentTypesAreRecordedAsTheyAreWritten(t *testing.T) {
	dir := t.TempDir()
	key := resourcecontract.GlobalSearchKey("ns")
	playlists := schema.GroupResource{Group: "playlist.grafana.app", Resource: "playlists"}
	docs := []*searchmodel.BulkIndexItem{
		refDoc(dashboardsGR, "ns", "dash-a", 11),
		refDoc(foldersGR, "ns", "folder-a", 12),
		refDoc(playlists, "ns", "playlist-a", 13),
	}
	{
		backend, _ := setupBleveBackend(t, withFileThreshold(1), withRootDir(dir))
		idx, err := backend.BuildIndex(t.Context(), key, int64(len(docs)), "test", func(index searchmodel.ResourceIndex) (int64, error) {
			return 1, index.BulkIndex(&searchmodel.BulkIndexRequest{Items: docs})
		}, nil, false, time.Time{}, 0)
		require.NoError(t, err)
		require.NoError(t, idx.BulkIndex(&searchmodel.BulkIndexRequest{Items: []*searchmodel.BulkIndexItem{{
			Action: searchmodel.ActionDelete,
			Key:    &resourcepb.ResourceKey{Namespace: "ns", Group: foldersGR.Group, Resource: foldersGR.Resource, Name: "folder-a"},
		}}}))
		require.NoError(t, idx.RecordCompletedTypeBuild(playlists, searchmodel.TypeBuild{StorageImportTime: importMonday}))
		require.NoError(t, idx.ForgetType(playlists))
		backend.Stop()
	}

	reopened, _ := setupBleveBackend(t, withFileThreshold(1), withRootDir(dir))
	idx, err := reopened.BuildIndex(t.Context(), key, int64(len(docs)), "test", func(searchmodel.ResourceIndex) (int64, error) {
		return 0, errors.New("the index on disk should have been reused, not built again")
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	types, err := idx.DocumentTypes()
	require.NoError(t, err)
	assert.Equal(t, []schema.GroupResource{dashboardsGR, foldersGR}, types)
	builds, err := idx.CompletedTypeBuilds()
	require.NoError(t, err)
	assert.Empty(t, builds, "forgotten from both records")
}

// Zero until recorded, then kept to the nanosecond.
func TestReconciledAtIsRecorded(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	idx, err := backend.BuildIndex(t.Context(), typeBuildsKey, 1, "test", indexTestDocs(typeBuildsKey, 1, 100), nil, false, time.Time{}, 0)
	require.NoError(t, err)

	at, err := idx.ReconciledAt()
	require.NoError(t, err)
	assert.Zero(t, at)

	require.NoError(t, idx.RecordReconciledAt(importMonday))
	at, err = idx.ReconciledAt()
	require.NoError(t, err)
	assert.Equal(t, importMonday, at)
}

// Kept inside the index, so a restarted server does not redo an import it has
// already caught up with.
func TestCompletedTypeBuildsSurviveReopening(t *testing.T) {
	dir := t.TempDir()
	const docs = 10
	{
		backend, _ := setupBleveBackend(t, withFileThreshold(5), withRootDir(dir))
		build := func(index searchmodel.ResourceIndex) (int64, error) {
			rv, err := indexTestDocs(typeBuildsKey, docs, 100)(index)
			if err != nil {
				return rv, err
			}
			return rv, index.RecordCompletedTypeBuild(importedA, searchmodel.TypeBuild{StorageImportTime: importMonday})
		}
		_, err := backend.BuildIndex(t.Context(), typeBuildsKey, docs, "test", build, nil, false, time.Time{}, 0)
		require.NoError(t, err)
		backend.Stop()
	}

	reopened, _ := setupBleveBackend(t, withFileThreshold(5), withRootDir(dir))
	idx, err := reopened.BuildIndex(t.Context(), typeBuildsKey, docs, "test", func(searchmodel.ResourceIndex) (int64, error) {
		return 0, errors.New("the index on disk should have been reused, not built again")
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	builds, err := idx.CompletedTypeBuilds()
	require.NoError(t, err)
	assert.Equal(t, map[schema.GroupResource]searchmodel.TypeBuild{importedA: {StorageImportTime: importMonday}}, builds)
}

// Notifications write to a global index outside its updater, so an index closed
// under them, as one evicted or replaced, must refuse the write rather than
// panic.
func TestWritingToAClosedGlobalIndexFails(t *testing.T) {
	backend, _ := setupBleveBackend(t, withFileThreshold(1), withRootDir(t.TempDir()))
	key := resourcecontract.GlobalSearchKey("ns")
	idx, err := backend.BuildIndex(t.Context(), key, 1, "test", func(index searchmodel.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&searchmodel.BulkIndexRequest{Items: []*searchmodel.BulkIndexItem{refDoc(dashboardsGR, "ns", "dash-a", 11)}})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	backend.Stop()

	err = idx.BulkIndex(&searchmodel.BulkIndexRequest{Items: []*searchmodel.BulkIndexItem{refDoc(foldersGR, "ns", "folder-a", 12)}})
	require.ErrorIs(t, err, bleve.ErrorIndexClosed)
}
