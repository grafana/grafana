package search

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
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

// Two resource types can hold the same name, so on a namespace-wide index the
// name alone does not order results. Paging one at a time has to return each
// document exactly once.
func TestGlobalIndexPagesThroughSameNamedDocuments(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "default"})
	key := resource.GlobalSearchKey("default")

	doc := func(group, res, name string) *resource.BulkIndexItem {
		return &resource.BulkIndexItem{
			Action: resource.ActionIndex,
			Doc: &resource.IndexableDocument{
				RV:    1,
				Name:  name,
				Title: name,
				Key:   &resourcepb.ResourceKey{Namespace: key.Namespace, Group: group, Resource: res, Name: name},
			},
		}
	}
	index, err := backend.BuildIndex(ctx, key, 3, "test", func(index resource.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
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
			SortBy:      []*resourcepb.ResourceSearchRequest_Sort{{Field: resource.SEARCH_FIELD_NAME}},
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
	typeBuildsKey = resource.NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}
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

	require.NoError(t, idx.RecordCompletedTypeBuild(importedA, resource.TypeBuild{StorageImportTime: importMonday}))
	require.NoError(t, idx.RecordCompletedTypeBuild(importedB, resource.TypeBuild{StorageImportTime: importMonday.Add(time.Hour)}))
	require.NoError(t, idx.RecordCompletedTypeBuild(importedA, resource.TypeBuild{StorageImportTime: importMonday.Add(2 * time.Hour)}))

	builds, err := idx.CompletedTypeBuilds()
	require.NoError(t, err)
	assert.Equal(t, map[schema.GroupResource]resource.TypeBuild{
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

	require.NoError(t, idx.RecordCompletedTypeBuild(importedA, resource.TypeBuild{}))
	require.NoError(t, idx.RecordCompletedTypeBuild(importedB, resource.TypeBuild{StorageImportTime: importMonday}))
	builds, err := idx.CompletedTypeBuilds()
	require.NoError(t, err)
	assert.Equal(t, map[schema.GroupResource]resource.TypeBuild{importedA: {}, importedB: {StorageImportTime: importMonday}}, builds)

	require.NoError(t, idx.ForgetType(importedB))
	builds, err = idx.CompletedTypeBuilds()
	require.NoError(t, err)
	assert.Equal(t, map[schema.GroupResource]resource.TypeBuild{importedA: {}}, builds)
}

// A type is recorded as it is first written, and a delete does not forget it:
// only ForgetType does, after its documents are removed. Kept inside the index,
// so a restarted server still finds a type written in part.
func TestDocumentTypesAreRecordedAsTheyAreWritten(t *testing.T) {
	dir := t.TempDir()
	key := resource.GlobalSearchKey("ns")
	playlists := schema.GroupResource{Group: "playlist.grafana.app", Resource: "playlists"}
	docs := []*resource.BulkIndexItem{
		refDoc(dashboardsGR, "ns", "dash-a", 11),
		refDoc(foldersGR, "ns", "folder-a", 12),
		refDoc(playlists, "ns", "playlist-a", 13),
	}
	{
		backend, _ := setupBleveBackend(t, withFileThreshold(1), withRootDir(dir))
		idx, err := backend.BuildIndex(t.Context(), key, int64(len(docs)), "test", func(index resource.ResourceIndex) (int64, error) {
			return 1, index.BulkIndex(&resource.BulkIndexRequest{Items: docs})
		}, nil, false, time.Time{}, 0)
		require.NoError(t, err)
		require.NoError(t, idx.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{{
			Action: resource.ActionDelete,
			Key:    &resourcepb.ResourceKey{Namespace: "ns", Group: foldersGR.Group, Resource: foldersGR.Resource, Name: "folder-a"},
		}}}))
		require.NoError(t, idx.RecordCompletedTypeBuild(playlists, resource.TypeBuild{StorageImportTime: importMonday}))
		require.NoError(t, idx.ForgetType(playlists))
		backend.Stop()
	}

	reopened, _ := setupBleveBackend(t, withFileThreshold(1), withRootDir(dir))
	idx, err := reopened.BuildIndex(t.Context(), key, int64(len(docs)), "test", func(resource.ResourceIndex) (int64, error) {
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
		build := func(index resource.ResourceIndex) (int64, error) {
			rv, err := indexTestDocs(typeBuildsKey, docs, 100)(index)
			if err != nil {
				return rv, err
			}
			return rv, index.RecordCompletedTypeBuild(importedA, resource.TypeBuild{StorageImportTime: importMonday})
		}
		_, err := backend.BuildIndex(t.Context(), typeBuildsKey, docs, "test", build, nil, false, time.Time{}, 0)
		require.NoError(t, err)
		backend.Stop()
	}

	reopened, _ := setupBleveBackend(t, withFileThreshold(5), withRootDir(dir))
	idx, err := reopened.BuildIndex(t.Context(), typeBuildsKey, docs, "test", func(resource.ResourceIndex) (int64, error) {
		return 0, errors.New("the index on disk should have been reused, not built again")
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	builds, err := idx.CompletedTypeBuilds()
	require.NoError(t, err)
	assert.Equal(t, map[schema.GroupResource]resource.TypeBuild{importedA: {StorageImportTime: importMonday}}, builds)
}

// Notifications write to a global index outside its updater, so an index closed
// under them, as one evicted or replaced, must refuse the write rather than
// panic.
func TestWritingToAClosedGlobalIndexFails(t *testing.T) {
	backend, _ := setupBleveBackend(t, withFileThreshold(1), withRootDir(t.TempDir()))
	key := resource.GlobalSearchKey("ns")
	idx, err := backend.BuildIndex(t.Context(), key, 1, "test", func(index resource.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{refDoc(dashboardsGR, "ns", "dash-a", 11)}})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	backend.Stop()

	err = idx.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{refDoc(foldersGR, "ns", "folder-a", 12)}})
	require.ErrorIs(t, err, bleve.ErrorIndexClosed)
}

// folderTreeDoc is a folder or dashboard document in the folder given.
func folderTreeDoc(key resource.NamespacedResource, res, name, folder string) *resource.BulkIndexItem {
	group := "dashboard.grafana.app"
	if res == "folders" {
		group = "folder.grafana.app"
	}
	return &resource.BulkIndexItem{
		Action: resource.ActionIndex,
		Doc: &resource.IndexableDocument{
			RV:     1,
			Name:   name,
			Key:    &resourcepb.ResourceKey{Namespace: key.Namespace, Group: group, Resource: res, Name: name},
			Title:  name,
			Folder: folder,
		},
	}
}

// searchFolderTree returns the names a folderTree filter on folders finds.
func searchFolderTree(t *testing.T, index resource.ResourceIndex, folders ...string) []string {
	t.Helper()
	ctx := identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "default"})
	rsp, err := index.Search(ctx, NewStubAccessClient(map[string]bool{"dashboards": true, "folders": true}), &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{Namespace: "default"},
			Fields: []*resourcepb.Requirement{{
				Key: resource.SEARCH_FIELD_FOLDER_TREE, Operator: string(selection.In), Values: folders,
			}},
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

// A folderTree filter finds what is in a folder and everything below it, and
// follows folder moves and deletes at once, without rewriting what is below.
func TestGlobalIndexSearchesAFolderAndEverythingBelowIt(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	key := resource.GlobalSearchKey("default")
	index, err := backend.BuildIndex(t.Context(), key, 3, "test", func(index resource.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
			folderTreeDoc(key, "folders", "top", ""),
			folderTreeDoc(key, "folders", "mid", "top"),
			folderTreeDoc(key, "folders", "leaf", "mid"),
			folderTreeDoc(key, "folders", "other", "general"),
			folderTreeDoc(key, "dashboards", "dash-top", "top"),
			folderTreeDoc(key, "dashboards", "dash-mid", "mid"),
			folderTreeDoc(key, "dashboards", "dash-leaf", "leaf"),
			folderTreeDoc(key, "dashboards", "dash-root", ""),
			folderTreeDoc(key, "dashboards", "dash-other", "other"),
		}})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	assert.ElementsMatch(t, []string{"mid", "leaf", "dash-top", "dash-mid", "dash-leaf"}, searchFolderTree(t, index, "top"),
		"what is below top, but not top itself")
	assert.ElementsMatch(t, []string{"leaf", "dash-mid", "dash-leaf"}, searchFolderTree(t, index, "mid"))
	assert.ElementsMatch(t, []string{"dash-leaf", "dash-other"}, searchFolderTree(t, index, "leaf", "other"),
		"several folders at once")
	assert.Len(t, searchFolderTree(t, index, "general"), 9, "everything is below the top")

	// Moving mid under other moves everything below it, though only mid is written.
	require.NoError(t, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
		folderTreeDoc(key, "folders", "mid", "other"),
	}}))
	assert.ElementsMatch(t, []string{"dash-top"}, searchFolderTree(t, index, "top"))
	assert.ElementsMatch(t, []string{"mid", "leaf", "dash-mid", "dash-leaf", "dash-other"}, searchFolderTree(t, index, "other"))

	// A deleted folder no longer leads to what was below it.
	require.NoError(t, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{{
		Action: resource.ActionDelete,
		Key:    &resourcepb.ResourceKey{Namespace: key.Namespace, Group: "folder.grafana.app", Resource: "folders", Name: "mid"},
	}}}))
	assert.ElementsMatch(t, []string{"dash-other"}, searchFolderTree(t, index, "other"))
}

// A loop in the folder tree ends the search below a folder rather than hanging.
func TestGlobalIndexFolderTreeSearchEndsAtALoop(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	key := resource.GlobalSearchKey("default")
	index, err := backend.BuildIndex(t.Context(), key, 3, "test", func(index resource.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
			folderTreeDoc(key, "folders", "loop-a", "loop-b"),
			folderTreeDoc(key, "folders", "loop-b", "loop-a"),
			folderTreeDoc(key, "dashboards", "dash-a", "loop-a"),
		}})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	assert.ElementsMatch(t, []string{"loop-a", "loop-b", "dash-a"}, searchFolderTree(t, index, "loop-a"))
}

// The tree is read from the index, so an index reopened from disk answers too.
func TestGlobalIndexFolderTreeSurvivesReopening(t *testing.T) {
	dir := t.TempDir()
	key := resource.GlobalSearchKey("default")
	{
		backend, _ := setupBleveBackend(t, withFileThreshold(1), withRootDir(dir))
		_, err := backend.BuildIndex(t.Context(), key, 10, "test", func(index resource.ResourceIndex) (int64, error) {
			return 1, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
				folderTreeDoc(key, "folders", "top", ""),
				folderTreeDoc(key, "folders", "mid", "top"),
				folderTreeDoc(key, "dashboards", "dash-mid", "mid"),
			}})
		}, nil, false, time.Time{}, 0)
		require.NoError(t, err)
		backend.Stop()
	}

	reopened, _ := setupBleveBackend(t, withFileThreshold(1), withRootDir(dir))
	index, err := reopened.BuildIndex(t.Context(), key, 10, "test", func(resource.ResourceIndex) (int64, error) {
		return 0, errors.New("the index on disk should have been reused, not built again")
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	assert.ElementsMatch(t, []string{"mid", "dash-mid"}, searchFolderTree(t, index, "top"))
}

// Only a global index holds folders together with what is in them.
func TestPerResourceIndexRefusesFolderTreeSearches(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	key := resource.NamespacedResource{Namespace: "default", Group: "dashboard.grafana.app", Resource: "dashboards"}
	index, err := backend.BuildIndex(t.Context(), key, 1, "test", func(resource.ResourceIndex) (int64, error) { return 1, nil }, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	rsp, err := index.Search(identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "default"}), NewStubAccessClient(map[string]bool{"dashboards": true}), &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{Namespace: "default", Group: key.Group, Resource: key.Resource},
			Fields: []*resourcepb.Requirement{{
				Key: resource.SEARCH_FIELD_FOLDER_TREE, Operator: string(selection.In), Values: []string{"top"},
			}},
		},
		Limit: 10,
	}, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, rsp.Error)
	assert.Equal(t, int32(400), rsp.Error.Code)
}

// Writes while the tree is loading or being searched are not lost: the last move
// is what a search sees afterwards.
func TestGlobalIndexFolderTreeKeepsUpWithConcurrentMoves(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	key := resource.GlobalSearchKey("default")
	index, err := backend.BuildIndex(t.Context(), key, 3, "test", func(index resource.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
			folderTreeDoc(key, "folders", "a", ""),
			folderTreeDoc(key, "folders", "b", ""),
			folderTreeDoc(key, "folders", "mid", "a"),
			folderTreeDoc(key, "dashboards", "dash-mid", "mid"),
		}})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	var wg sync.WaitGroup
	wg.Go(func() {
		for i := range 50 {
			parent := "a"
			if i%2 == 0 {
				parent = "b"
			}
			assert.NoError(t, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
				folderTreeDoc(key, "folders", "mid", parent),
			}}))
		}
	})
	for range 20 {
		searchFolderTree(t, index, "a")
	}
	wg.Wait()

	// The last move, i == 49, put mid under a.
	assert.ElementsMatch(t, []string{"mid", "dash-mid"}, searchFolderTree(t, index, "a"))
	assert.Empty(t, searchFolderTree(t, index, "b"))
}

// A batch writing a folder commits and changes the tree as one step, so two
// writers cannot leave the tree in a different order from the index. Other
// batches do not wait for the tree.
func TestFolderTreeChangesInTheOrderTheIndexCommits(t *testing.T) {
	key := resource.GlobalSearchKey("default")
	tree := &folderTree{loaded: true, parent: map[string]string{}, children: map[string]map[string]struct{}{}}

	require.NoError(t, tree.commit([]*resource.BulkIndexItem{folderTreeDoc(key, "folders", "mid", "top")}, func() error {
		assert.False(t, tree.mu.TryLock(), "a folder write holds the tree while it commits")
		return nil
	}))
	assert.Equal(t, map[string]string{"mid": "top"}, tree.parent)

	require.NoError(t, tree.commit([]*resource.BulkIndexItem{folderTreeDoc(key, "dashboards", "dash", "mid")}, func() error {
		require.True(t, tree.mu.TryLock(), "a write of no folders leaves the tree alone")
		tree.mu.Unlock()
		return nil
	}))

	// A failed commit changes nothing.
	require.Error(t, tree.commit([]*resource.BulkIndexItem{folderTreeDoc(key, "folders", "mid", "other")}, func() error {
		return errors.New("commit failed")
	}))
	assert.Equal(t, map[string]string{"mid": "top"}, tree.parent)
}

// Memory follows the tree as it is, not every folder it ever held.
func TestFolderTreeForgetsFoldersWithNothingBelowThem(t *testing.T) {
	tree := &folderTree{parent: map[string]string{}, children: map[string]map[string]struct{}{}}
	tree.set("top", "")
	tree.set("mid", "top")
	tree.set("leaf", "mid")

	tree.set("mid", "other")
	assert.NotContains(t, tree.children, "top", "nothing is below top any more")

	tree.remove("leaf")
	tree.remove("mid")
	tree.remove("top")
	assert.Empty(t, tree.parent)
	assert.Empty(t, tree.children)
}

// = names one folder and in several, as on other fields, rather than = quietly
// meaning in.
func TestFolderTreeSearchOperators(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	key := resource.GlobalSearchKey("default")
	index, err := backend.BuildIndex(t.Context(), key, 3, "test", func(index resource.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
			folderTreeDoc(key, "folders", "top", ""),
			folderTreeDoc(key, "dashboards", "dash-top", "top"),
		}})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)

	search := func(operator string, values ...string) *resourcepb.ResourceSearchResponse {
		rsp, err := index.Search(identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "default"}),
			NewStubAccessClient(map[string]bool{"dashboards": true, "folders": true}), &resourcepb.ResourceSearchRequest{
				Options: &resourcepb.ListOptions{
					Key:    &resourcepb.ResourceKey{Namespace: "default"},
					Fields: []*resourcepb.Requirement{{Key: resource.SEARCH_FIELD_FOLDER_TREE, Operator: operator, Values: values}},
				},
				Limit: 10,
			}, nil, nil)
		require.NoError(t, err)
		return rsp
	}

	rsp := search(string(selection.Equals), "top")
	require.Nil(t, rsp.Error)
	assert.Len(t, rsp.Results.Rows, 1)
	rsp = search(string(selection.Equals), "general")
	require.Nil(t, rsp.Error)
	assert.Len(t, rsp.Results.Rows, 2, "everything is below the top")

	for _, tc := range []struct {
		operator string
		values   []string
	}{
		{string(selection.Equals), []string{"top", "general"}},
		{string(selection.DoubleEquals), []string{"top", "other"}},
		{string(selection.NotIn), []string{"top"}},
	} {
		rsp := search(tc.operator, tc.values...)
		require.NotNil(t, rsp.Error, "%s %v", tc.operator, tc.values)
		assert.Equal(t, int32(400), rsp.Error.Code)
	}
}
