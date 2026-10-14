package search

import (
	"context"
	"errors"
	"fmt"
	"runtime"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/blevesearch/bleve/v2"
	"github.com/blevesearch/bleve/v2/search"
	index "github.com/blevesearch/bleve_index_api"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
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
	// Both ways of filtering on the folders found: a term per folder, and a check
	// of each document's folder against the set.
	for _, limit := range []int{folderTermFilterLimit, 0} {
		t.Run(fmt.Sprintf("term filter limit %d", limit), func(t *testing.T) {
			defer func(old int) { folderTermFilterLimit = old }(folderTermFilterLimit)
			folderTermFilterLimit = limit
			testGlobalIndexSearchesAFolderAndEverythingBelowIt(t)
		})
	}
}

func testGlobalIndexSearchesAFolderAndEverythingBelowIt(t *testing.T) {
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

// BenchmarkGlobalFolderTree measures searches of a folder and everything below
// it in a global index the size of the largest namespaces: 300k folders, each
// holding one dashboard. Subtrees of 100, 10k and 100k folders have ten
// subfolders per folder.
//
//	go test ./pkg/storage/unified/search/ -run '^$' -bench BenchmarkGlobalFolderTree -benchtime 20x
func BenchmarkGlobalFolderTree(b *testing.B) {
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

	subtrees := []struct {
		root string
		size int
	}{{"s100", 100}, {"s10k", 10_000}, {"s100k", 100_000}, {"rest", 190_000}}
	var items []*resource.BulkIndexItem
	for _, st := range subtrees {
		names := make([]string, st.size)
		for i := range st.size {
			names[i] = fmt.Sprintf("%s-%d", st.root, i)
			parent := ""
			if i > 0 {
				parent = names[(i-1)/10]
			}
			items = append(items,
				folderTreeDoc(key, "folders", names[i], parent),
				folderTreeDoc(key, "dashboards", "dash-"+names[i], names[i]))
		}
	}
	folders := len(items) / 2

	start := time.Now()
	built, err := backend.BuildIndex(b.Context(), key, int64(len(items)), "benchmark", func(index resource.ResourceIndex) (int64, error) {
		for chunk := range slices.Chunk(items, 10_000) {
			if err := index.BulkIndex(&resource.BulkIndexRequest{Items: chunk}); err != nil {
				return 0, err
			}
		}
		return 1, nil
	}, nil, false, time.Time{}, 0)
	require.NoError(b, err)
	b.Logf("built %d documents in %s", len(items), time.Since(start))
	index := built.(*bleveIndex)

	unload := func() {
		index.folders.mu.Lock()
		index.folders.loaded = false
		index.folders.parent, index.folders.children = nil, nil
		index.folders.mu.Unlock()
	}

	b.Run("load", func(b *testing.B) {
		b.ReportAllocs()
		var bytesPerFolder float64
		for b.Loop() {
			b.StopTimer()
			unload()
			runtime.GC()
			var before, after runtime.MemStats
			runtime.ReadMemStats(&before)
			b.StartTimer()

			_, err := index.folderSubtree(b.Context(), []string{"s100-0"})
			require.NoError(b, err)

			b.StopTimer()
			runtime.GC()
			runtime.ReadMemStats(&after)
			// The whole process's heap, so it can also shrink; that run says nothing.
			if grown := int64(after.HeapAlloc) - int64(before.HeapAlloc); grown > 0 {
				bytesPerFolder = float64(grown) / float64(folders)
			}
			b.StartTimer()
		}
		b.ReportMetric(bytesPerFolder, "tree-bytes/folder")
	})

	access := NewStubAccessClient(map[string]bool{"dashboards": true, "folders": true})
	ctx := identity.WithRequester(b.Context(), &user.SignedInUser{Namespace: "default"})
	search := func(b *testing.B, field, folder string) {
		rsp, err := index.Search(ctx, access, &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "default"},
				Fields: []*resourcepb.Requirement{{Key: field, Operator: string(selection.In), Values: []string{folder}}},
			},
			Limit: 10,
		}, nil, nil)
		require.NoError(b, err)
		require.Nil(b, rsp.Error)
		require.Len(b, rsp.Results.Rows, 10)
	}

	for _, st := range subtrees[:3] {
		root := st.root + "-0"
		b.Run(fmt.Sprintf("expand/subtree=%d", st.size), func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				found, err := index.folderSubtree(b.Context(), []string{root})
				require.NoError(b, err)
				require.Len(b, found, st.size)
			}
		})
		for _, filter := range []struct {
			name  string
			limit int
		}{{"terms", st.size}, {"set", 0}} {
			b.Run(fmt.Sprintf("search-%s/subtree=%d", filter.name, st.size), func(b *testing.B) {
				defer func(old int) { folderTermFilterLimit = old }(folderTermFilterLimit)
				folderTermFilterLimit = filter.limit
				b.ReportAllocs()
				for b.Loop() {
					search(b, resource.SEARCH_FIELD_FOLDER_TREE, root)
				}
			})
		}
		b.Run(fmt.Sprintf("search-parallel-with-moves/subtree=%d", st.size), func(b *testing.B) {
			b.ReportAllocs()
			stop := make(chan struct{})
			var wg sync.WaitGroup
			wg.Go(func() {
				for i := 0; ; i++ {
					select {
					case <-stop:
						return
					default:
					}
					// A folder in "rest" moves back and forth, so every move takes the
					// tree's lock but leaves the searched subtree alone.
					parent := "rest-1"
					if i%2 == 0 {
						parent = "rest-2"
					}
					assert.NoError(b, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
						folderTreeDoc(key, "folders", "rest-100", parent),
					}}))
				}
			})
			b.RunParallel(func(pb *testing.PB) {
				for pb.Next() {
					search(b, resource.SEARCH_FIELD_FOLDER_TREE, root)
				}
			})
			close(stop)
			wg.Wait()
		})
	}
	// For comparison: every document, and a filter on one folder, without the tree.
	b.Run("search/everything", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			search(b, resource.SEARCH_FIELD_FOLDER_TREE, "general")
		}
	})
	b.Run("search/one-folder", func(b *testing.B) {
		b.ReportAllocs()
		for b.Loop() {
			search(b, resource.SEARCH_FIELD_FOLDER, "s100-0")
		}
	})
}

// failingDocValues fails every read of a document's folder.
type failingDocValues struct{}

func (failingDocValues) VisitDocValues(index.IndexInternalID, index.DocValueVisitor) error {
	return errors.New("doc values are unreadable")
}
func (failingDocValues) BytesRead() uint64 { return 0 }

// A folder set check reads documents it does not pass on, so it stops when the
// search is cancelled, and fails when a folder cannot be read rather than
// leaving the document out.
func TestFolderSetSearcherStopsOnCancelAndFailsOnUnreadableFolders(t *testing.T) {
	backend, _ := setupBleveBackend(t)
	key := resource.GlobalSearchKey("default")
	built, err := backend.BuildIndex(t.Context(), key, 3, "test", func(index resource.ResourceIndex) (int64, error) {
		items := make([]*resource.BulkIndexItem, 0, 2*folderSetCheckEvery)
		for i := range 2 * folderSetCheckEvery {
			items = append(items, folderTreeDoc(key, "dashboards", fmt.Sprintf("dash-%d", i), "elsewhere"))
		}
		return 1, index.BulkIndex(&resource.BulkIndexRequest{Items: items})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	idx := built.(*bleveIndex)
	advanced, err := idx.index.Advanced()
	require.NoError(t, err)
	reader, err := advanced.Reader()
	require.NoError(t, err)
	t.Cleanup(func() { _ = reader.Close() })

	next := func(ctx context.Context, folders index.DocValueReader) error {
		all, err := bleve.NewMatchAllQuery().Searcher(ctx, reader, idx.index.Mapping(), search.SearcherOptions{})
		require.NoError(t, err)
		defer func() { _ = all.Close() }()
		s := newFolderSetSearcher(ctx, all, folders, map[string]struct{}{"wanted": {}})
		_, err = s.Next(&search.SearchContext{DocumentMatchPool: search.NewDocumentMatchPool(s.DocumentMatchPoolSize(), 0)})
		return err
	}

	dv, err := reader.DocValueReader([]string{resource.SEARCH_FIELD_FOLDER})
	require.NoError(t, err)
	require.NoError(t, next(t.Context(), dv), "no document is in the set, and that is not an error")

	cancelled, cancel := context.WithCancel(t.Context())
	cancel()
	require.ErrorIs(t, next(cancelled, dv), context.Canceled)

	require.ErrorContains(t, next(t.Context(), failingDocValues{}), "doc values are unreadable")
}

// Combined with a text query, a folder set check still returns its errors
// rather than counting them as documents that do not match: bleve drops the
// errors of filters, so the check wraps the search instead of being one.
func TestFolderSetCheckErrorsReachTheSearchWithATextQuery(t *testing.T) {
	defer func(old int) { folderTermFilterLimit = old }(folderTermFilterLimit)
	folderTermFilterLimit = 0

	backend, _ := setupBleveBackend(t)
	key := resource.GlobalSearchKey("default")
	built, err := backend.BuildIndex(t.Context(), key, 3, "test", func(index resource.ResourceIndex) (int64, error) {
		return 1, index.BulkIndex(&resource.BulkIndexRequest{Items: []*resource.BulkIndexItem{
			folderTreeDoc(key, "folders", "top", ""),
			folderTreeDoc(key, "dashboards", "dash-top", "top"),
			folderTreeDoc(key, "dashboards", "dash-root", ""),
		}})
	}, nil, false, time.Time{}, 0)
	require.NoError(t, err)
	idx := built.(*bleveIndex)

	run := func(readFolders func(index.IndexReader) (index.DocValueReader, error)) ([]string, error) {
		filters, errResult := idx.filterQueries(t.Context(), &resourcepb.ResourceSearchRequest{Options: &resourcepb.ListOptions{
			Key:    &resourcepb.ResourceKey{Namespace: "default"},
			Fields: []*resourcepb.Requirement{{Key: resource.SEARCH_FIELD_FOLDER_TREE, Operator: string(selection.In), Values: []string{"top"}}},
		}})
		require.Nil(t, errResult)
		require.Len(t, filters, 1)
		filters[0].(*folderSetQuery).readFolders = readFolders
		text := bleve.NewMatchQuery("dash")
		text.SetField(resource.SEARCH_FIELD_TITLE)
		rsp, err := idx.index.SearchInContext(t.Context(), bleve.NewSearchRequest(scopeQuery(wrapInFolderSets(filters, text), false, 0)))
		if err != nil {
			return nil, err
		}
		names := make([]string, 0, len(rsp.Hits))
		for _, hit := range rsp.Hits {
			names = append(names, hit.ID)
		}
		return names, nil
	}

	names, err := run(nil)
	require.NoError(t, err)
	assert.Equal(t, []string{"default/dashboard.grafana.app/dashboards/dash-top"}, names)

	// The same through Search, which builds the query itself.
	rsp, err := idx.Search(identity.WithRequester(t.Context(), &user.SignedInUser{Namespace: "default"}),
		NewStubAccessClient(map[string]bool{"dashboards": true, "folders": true}), &resourcepb.ResourceSearchRequest{
			Options: &resourcepb.ListOptions{
				Key:    &resourcepb.ResourceKey{Namespace: "default"},
				Fields: []*resourcepb.Requirement{{Key: resource.SEARCH_FIELD_FOLDER_TREE, Operator: string(selection.In), Values: []string{"top"}}},
			},
			Query: "dash",
			Limit: 10,
		}, nil, nil)
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
	require.Len(t, rsp.Results.Rows, 1)
	assert.Equal(t, "dash-top", rsp.Results.Rows[0].Key.Name)

	_, err = run(func(index.IndexReader) (index.DocValueReader, error) { return failingDocValues{}, nil })
	require.ErrorContains(t, err, "doc values are unreadable")
}
