package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// multiTypeStorage answers per resource type, so a test can tell which types an
// index read from and what each of them returned.
type multiTypeStorage struct {
	mockStorageBackend

	// Names whose stored body cannot be turned into a document.
	broken map[string]bool

	live     map[NamespacedResource][]string
	listRVs  map[NamespacedResource]int64
	modified map[NamespacedResource][]*ModifiedResource

	listed         []NamespacedResource
	modifiedSince  []NamespacedResource
	historyListed  []NamespacedResource
	lastSinceRVSet []int64
}

func keyOf(k *resourcepb.ResourceKey) NamespacedResource {
	return NamespacedResource{Namespace: k.GetNamespace(), Group: k.GetGroup(), Resource: k.GetResource()}
}

func (m *multiTypeStorage) ListIterator(_ context.Context, req *resourcepb.ListRequest, cb func(ListIterator) error) (int64, error) {
	key := keyOf(req.GetOptions().GetKey())
	m.listed = append(m.listed, key)

	rv := m.listRVs[key]
	if rv == 0 {
		rv = 1
	}
	return rv, cb(&namedListIterator{names: m.live[key], rv: rv, keysOnly: req.GetKeysOnly(), broken: m.broken})
}

// namedListIterator lists objects under their own names and resource version,
// which is what a caller comparing an index with storage has to see.
type namedListIterator struct {
	names    []string
	rv       int64
	keysOnly bool
	broken   map[string]bool
	pos      int
}

func (i *namedListIterator) Next() bool {
	i.pos++
	return i.pos <= len(i.names)
}
func (i *namedListIterator) Error() error           { return nil }
func (i *namedListIterator) ContinueToken() string  { return "" }
func (i *namedListIterator) ResourceVersion() int64 { return i.rv }
func (i *namedListIterator) Namespace() string      { return "ns" }
func (i *namedListIterator) Name() string           { return i.names[i.pos-1] }
func (i *namedListIterator) Folder() string         { return "" }
func (i *namedListIterator) Value() []byte {
	if i.keysOnly {
		// A keys-only listing reads no bodies.
		return nil
	}
	name := i.names[i.pos-1]
	if i.broken[name] {
		return []byte("not an object")
	}
	return testObjectJSON(name, name)
}

func (m *multiTypeStorage) ListHistory(_ context.Context, req *resourcepb.ListRequest, _ func(ListIterator) error) (int64, error) {
	m.historyListed = append(m.historyListed, keyOf(req.GetOptions().GetKey()))
	return 0, nil
}

func (m *multiTypeStorage) ListModifiedSince(_ context.Context, key NamespacedResource, sinceRV int64, _ *time.Time) (int64, iter.Seq2[*ModifiedResource, error]) {
	m.modifiedSince = append(m.modifiedSince, key)
	m.lastSinceRVSet = append(m.lastSinceRVSet, sinceRV)

	events := m.modified[key]
	rv := m.listRVs[key]
	if rv == 0 {
		rv = 1
	}
	return rv, func(yield func(*ModifiedResource, error) bool) {
		for _, e := range events {
			if !yield(e, nil) {
				return
			}
		}
	}
}

func globalTestServer(t *testing.T, storage StorageBackend, search *mockSearchBackend) *searchServer {
	t.Helper()
	server, err := newSearchServer(SearchOptions{
		Backend: search,
		Resources: &TestDocumentBuilderSupplier{GroupsResources: map[string]string{
			"dashboard.grafana.app": "dashboards",
			"folder.grafana.app":    "folders",
		}},
		GlobalIndexEnabled: true,
		InitMinCount:       1,
	}, storage, nil, nil, nil, nil, nil, ProvideIndexMetrics(nil), nil, nil)
	require.NoError(t, err)
	return server
}

func dashboardType(namespace string) NamespacedResource {
	return NamespacedResource{Namespace: namespace, Group: "dashboard.grafana.app", Resource: "dashboards"}
}

func folderType(namespace string) NamespacedResource {
	return NamespacedResource{Namespace: namespace, Group: "folder.grafana.app", Resource: "folders"}
}

// indexedNames returns the name of every document handed to the index, by
// resource type, so a test can see what the index actually holds.
func indexedNames(t *testing.T, idx *MockResourceIndex) map[NamespacedResource][]string {
	t.Helper()
	out := map[NamespacedResource][]string{}
	for _, item := range idx.bulkItems {
		require.Equal(t, ActionIndex, item.Action, "unexpected removal")
		require.NotNil(t, item.Doc)
		key := keyOf(item.Doc.Key)
		out[key] = append(out[key], item.Doc.Key.GetName())
	}
	return out
}

func TestGlobalIndexBuildReadsEveryCoveredType(t *testing.T) {
	storage := &multiTypeStorage{
		live: map[NamespacedResource][]string{
			dashboardType("ns"):    {"dash-a", "dash-b"},
			folderType("ns"):       {"folder-a"},
			dashboardType("other"): {"not-mine"},
		},
		// The folder listing is the newer of the two.
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 10, folderType("ns"): 20},
	}
	search := &mockSearchBackend{}
	server := globalTestServer(t, storage, search)

	idx, err := server.build(t.Context(), GlobalSearchKey("ns"), 3, "test", false, time.Time{})
	require.NoError(t, err)

	assert.ElementsMatch(t, []NamespacedResource{dashboardType("ns"), folderType("ns")}, storage.listed,
		"one listing per covered type, in this namespace only")

	assert.Equal(t, map[NamespacedResource][]string{
		dashboardType("ns"): {"dash-a", "dash-b"},
		folderType("ns"):    {"folder-a"},
	}, indexedNames(t, idx.(*MockResourceIndex)))

	// A namespace-wide index holds only live documents, so the pass that restores
	// deleted ones does not run.
	assert.Empty(t, storage.historyListed)
}

// The index is only as current as its oldest listing, so a change made while a
// later listing ran is picked up by the next update rather than missed.
func TestGlobalIndexBuildReportsTheOldestVersion(t *testing.T) {
	storage := &multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}, folderType("ns"): {"folder-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 30, folderType("ns"): 20},
	}
	search := &mockSearchBackend{}
	server := globalTestServer(t, storage, search)

	_, err := server.build(t.Context(), GlobalSearchKey("ns"), 2, "test", false, time.Time{})
	require.NoError(t, err)

	require.NotNil(t, search.lastUpdater)
	idx := &MockResourceIndex{}
	rv, _, err := search.lastUpdater(t.Context(), idx, 0)
	require.NoError(t, err)
	assert.Equal(t, int64(20), rv, "the oldest of the covered types")
}

func TestGlobalIndexUpdateFollowsEveryCoveredType(t *testing.T) {
	event := func(action resourcepb.WatchEvent_Type, key NamespacedResource, name string, rv int64) *ModifiedResource {
		return &ModifiedResource{
			Action:          action,
			Key:             resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: name},
			ResourceVersion: rv,
			Value:           testObjectJSON(name, name),
		}
	}
	storage := &multiTypeStorage{
		modified: map[NamespacedResource][]*ModifiedResource{
			dashboardType("ns"): {event(resourcepb.WatchEvent_MODIFIED, dashboardType("ns"), "dash-a", 11)},
			folderType("ns"):    {event(resourcepb.WatchEvent_ADDED, folderType("ns"), "folder-a", 12)},
		},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 11, folderType("ns"): 12},
	}
	search := &mockSearchBackend{}
	server := globalTestServer(t, storage, search)

	_, err := server.build(t.Context(), GlobalSearchKey("ns"), 0, "test", false, time.Time{})
	require.NoError(t, err)

	idx := &MockResourceIndex{}
	_, docs, err := search.lastUpdater(t.Context(), idx, 5)
	require.NoError(t, err)

	assert.Equal(t, 2, docs)
	assert.ElementsMatch(t, []NamespacedResource{dashboardType("ns"), folderType("ns")}, storage.modifiedSince)
	assert.Equal(t, []int64{5, 5}, storage.lastSinceRVSet, "every type is asked for changes since the same point")
	assert.Equal(t, map[NamespacedResource][]string{
		dashboardType("ns"): {"dash-a"},
		folderType("ns"):    {"folder-a"},
	}, indexedNames(t, idx))
}

// A delete removes the document. Trash lives in the per-resource index, and a
// namespace-wide index that kept a deleted document would serve it as a hit.
func TestGlobalIndexUpdateRemovesDeletedDocuments(t *testing.T) {
	deleted := &ModifiedResource{
		Action:          resourcepb.WatchEvent_DELETED,
		Key:             resourcepb.ResourceKey{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-a"},
		ResourceVersion: 11,
		Value:           testObjectJSON("dash-a", "dash-a"),
	}
	storage := &multiTypeStorage{
		modified: map[NamespacedResource][]*ModifiedResource{dashboardType("ns"): {deleted}},
	}
	// Even where the deployment keeps deleted documents, this index does not.
	search := &mockSearchBackend{keepsDeletedDocuments: true}
	server := globalTestServer(t, storage, search)

	_, err := server.build(t.Context(), GlobalSearchKey("ns"), 0, "test", false, time.Time{})
	require.NoError(t, err)

	idx := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: featuresForTestIndex(true)}}
	_, _, err = search.lastUpdater(t.Context(), idx, 5)
	require.NoError(t, err)

	require.Len(t, idx.bulkItems, 1)
	assert.Equal(t, ActionDelete, idx.bulkItems[0].Action)
	assert.Nil(t, idx.bulkItems[0].Doc, "no document is kept for a deleted object")
	assert.Equal(t, "dash-a", idx.bulkItems[0].Key.GetName())
}

// Per-resource indexes are unchanged: they read their own type and restore their
// trash, whatever the namespace-wide index does.
func TestPerResourceIndexIsUnaffected(t *testing.T) {
	storage := &multiTypeStorage{
		live: map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}, folderType("ns"): {"folder-a"}},
	}
	search := &mockSearchBackend{keepsDeletedDocuments: true}
	server := globalTestServer(t, storage, search)

	idx, err := server.build(t.Context(), dashboardType("ns"), 1, "test", false, time.Time{})
	require.NoError(t, err)

	assert.Equal(t, []NamespacedResource{dashboardType("ns")}, storage.listed)
	assert.Equal(t, []NamespacedResource{dashboardType("ns")}, storage.historyListed, "trash is restored as before")
	assert.Equal(t, map[NamespacedResource][]string{
		dashboardType("ns"): {"dash-a"},
	}, indexedNames(t, idx.(*MockResourceIndex)))
}

func TestGlobalIndexesAreIsolatedByNamespace(t *testing.T) {
	storage := &multiTypeStorage{
		live: map[NamespacedResource][]string{
			dashboardType("a"): {"a-dash"},
			dashboardType("b"): {"b-dash"},
		},
	}
	search := &mockSearchBackend{}
	server := globalTestServer(t, storage, search)

	for _, namespace := range []string{"a", "b"} {
		idx, err := server.build(t.Context(), GlobalSearchKey(namespace), 1, "test", false, time.Time{})
		require.NoError(t, err)

		for key := range indexedNames(t, idx.(*MockResourceIndex)) {
			assert.Equal(t, namespace, key.Namespace)
		}
	}
}

// The document builder writes its own resource type's fields, which this index
// declares none of, so they are dropped before the index sees them. A
// per-resource index keeps them.
func TestGlobalIndexKeepsStandardFieldsOnly(t *testing.T) {
	storage := &multiTypeStorage{
		live: map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		modified: map[NamespacedResource][]*ModifiedResource{dashboardType("ns"): {{
			Action:          resourcepb.WatchEvent_MODIFIED,
			Key:             resourcepb.ResourceKey{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards", Name: "dash-b"},
			ResourceVersion: 11,
			Value:           testObjectJSON("dash-b", "dash-b"),
		}}},
	}
	search := &mockSearchBackend{}
	server := globalTestServer(t, storage, search)

	global, err := server.build(t.Context(), GlobalSearchKey("ns"), 1, "test", false, time.Time{})
	require.NoError(t, err)
	built := global.(*MockResourceIndex).indexedItems()
	require.Len(t, built, 1)
	assert.Empty(t, built[0].Doc.Fields, "the build drops them")

	updated := &MockResourceIndex{}
	_, _, err = search.lastUpdater(t.Context(), updated, 5)
	require.NoError(t, err)
	require.Len(t, updated.indexedItems(), 1)
	assert.Empty(t, updated.indexedItems()[0].Doc.Fields, "so does an update")

	perResource, err := server.build(t.Context(), dashboardType("ns"), 1, "test", false, time.Time{})
	require.NoError(t, err)
	kept := perResource.(*MockResourceIndex).indexedItems()
	require.Len(t, kept, 1)
	assert.NotEmpty(t, kept[0].Doc.Fields, "a per-resource index keeps its own fields")
}

// The existing lifecycle metrics have to cover this index too, or a build nobody
// can see is the first sign of trouble.
func TestGlobalIndexBuildIsVisibleInMetrics(t *testing.T) {
	storage := &multiTypeStorage{
		live: map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}, folderType("ns"): {"folder-a"}},
	}
	metrics := ProvideIndexMetrics(prometheus.NewPedanticRegistry())
	search := &mockSearchBackend{}
	server, err := newSearchServer(SearchOptions{
		Backend: search,
		Resources: &TestDocumentBuilderSupplier{GroupsResources: map[string]string{
			"dashboard.grafana.app": "dashboards",
			"folder.grafana.app":    "folders",
		}},
		GlobalIndexEnabled: true,
		InitMinCount:       1,
	}, storage, nil, nil, nil, nil, nil, metrics, nil, nil)
	require.NoError(t, err)

	key := GlobalSearchKey("ns")
	_, err = server.build(t.Context(), key, 2, "test", false, time.Time{})
	require.NoError(t, err)

	// Reported under the index's own key, so it is one series rather than mixed in
	// with the per-resource indexes.
	labels := []string{IndexPhaseConvert, IndexPathBuild, key.Group, key.Resource}
	assert.Equal(t, 2.0, testutil.ToFloat64(metrics.BuildDocuments.WithLabelValues(labels...)),
		"both documents are counted, whichever type they came from")
}

// With the index switched off, nothing brings one into existence: not an index
// the previous run left recorded as open, and not a request that names it.
func TestGlobalIndexStaysOffWhenSwitchedOff(t *testing.T) {
	storage := &multiTypeStorage{
		live: map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
	}
	search := &mockSearchBackend{openIndexStats: []ResourceStats{
		{NamespacedResource: dashboardType("ns"), Count: 1},
		{NamespacedResource: GlobalSearchKey("ns"), Count: 1},
	}}
	server, err := newSearchServer(SearchOptions{
		Backend: search,
		Resources: &TestDocumentBuilderSupplier{GroupsResources: map[string]string{
			"dashboard.grafana.app": "dashboards",
			"folder.grafana.app":    "folders",
		}},
		GlobalIndexEnabled: false,
		InitMinCount:       1,
	}, storage, nil, nil, nil, nil, nil, ProvideIndexMetrics(nil), nil, nil)
	require.NoError(t, err)

	_, err = server.buildIndexes(t.Context())
	require.NoError(t, err)
	for _, call := range search.buildIndexCalls {
		assert.False(t, call.key.IsGlobal(), "a restored namespace-wide index must not be built while switched off")
	}
	assert.NotEmpty(t, search.buildIndexCalls, "the per-resource index is still built")

	_, err = server.getOrCreateIndex(t.Context(), nil, GlobalSearchKey("ns"), "test")
	require.Error(t, err)
	assert.Nil(t, search.GetIndex(GlobalSearchKey("ns")))
}

// The update skips a change it has already applied, but each resource type counts
// its versions on its own, so a dashboard and a folder can share both a name and
// a version. Both must be applied, and each skipped only when it repeats.
func TestGlobalIndexUpdateTellsTypesApartWhenSkippingRepeats(t *testing.T) {
	same := func(key NamespacedResource) *ModifiedResource {
		return &ModifiedResource{
			Action:          resourcepb.WatchEvent_MODIFIED,
			Key:             resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: "shared"},
			ResourceVersion: 11,
			Value:           testObjectJSON("shared", "shared"),
		}
	}
	storage := &multiTypeStorage{
		modified: map[NamespacedResource][]*ModifiedResource{
			dashboardType("ns"): {same(dashboardType("ns"))},
			folderType("ns"):    {same(folderType("ns"))},
		},
	}
	search := &mockSearchBackend{}
	server, err := newSearchServer(SearchOptions{
		Backend: search,
		Resources: &TestDocumentBuilderSupplier{GroupsResources: map[string]string{
			"dashboard.grafana.app": "dashboards",
			"folder.grafana.app":    "folders",
		}},
		GlobalIndexEnabled: true,
		InitMinCount:       1,
		// Switches on the cache that remembers applied changes.
		IndexModificationCacheTTL: time.Minute,
	}, storage, nil, nil, nil, nil, nil, ProvideIndexMetrics(nil), nil, nil)
	require.NoError(t, err)

	_, err = server.build(t.Context(), GlobalSearchKey("ns"), 0, "test", false, time.Time{})
	require.NoError(t, err)

	first := &MockResourceIndex{}
	_, _, err = search.lastUpdater(t.Context(), first, 5)
	require.NoError(t, err)
	assert.Equal(t, map[NamespacedResource][]string{
		dashboardType("ns"): {"shared"},
		folderType("ns"):    {"shared"},
	}, indexedNames(t, first), "both are applied, not one taken for the other")

	// The same changes reported again are skipped for both.
	again := &MockResourceIndex{}
	_, _, err = search.lastUpdater(t.Context(), again, 5)
	require.NoError(t, err)
	assert.Empty(t, again.indexedItems())
}

// Identity is the whole key, so two resource types can hold the same name
// without one replacing the other.
func TestGlobalIndexKeepsNamesOfDifferentTypesApart(t *testing.T) {
	storage := &multiTypeStorage{
		live: map[NamespacedResource][]string{
			dashboardType("ns"): {"shared-name"},
			folderType("ns"):    {"shared-name"},
		},
	}
	search := &mockSearchBackend{}
	server := globalTestServer(t, storage, search)

	idx, err := server.build(t.Context(), GlobalSearchKey("ns"), 2, "test", false, time.Time{})
	require.NoError(t, err)

	ids := map[string]bool{}
	for _, item := range idx.(*MockResourceIndex).bulkItems {
		ids[SearchID(item.Doc.Key)] = true
	}
	assert.Len(t, ids, 2, fmt.Sprintf("two documents, not one: %v", ids))
}

// reconcileStorage records reads, so tests can show a reconcile reads only what drifted.
type reconcileStorage struct {
	multiTypeStorage

	// Names read, in order.
	read []string
	// Set to refuse batch reads, as a backend without them does.
	noBatchReads bool
	// Runs right after the listing, to simulate a write arriving then.
	afterList func()
	// Simulates storage being unavailable.
	readErr error
}

func (m *reconcileStorage) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(ListIterator) error) (int64, error) {
	rv, err := m.multiTypeStorage.ListIterator(ctx, req, cb)
	if m.afterList != nil {
		m.afterList()
	}
	return rv, err
}

func (m *reconcileStorage) BatchReadResource(_ context.Context, requests []*resourcepb.ReadRequest) (iter.Seq[*BackendReadResponse], error) {
	if m.readErr != nil {
		return nil, m.readErr
	}
	if m.noBatchReads {
		return nil, ErrBatchReadUnsupported
	}
	responses := make([]*BackendReadResponse, 0, len(requests))
	for _, request := range requests {
		responses = append(responses, m.readOne(request))
	}
	return func(yield func(*BackendReadResponse) bool) {
		for _, response := range responses {
			if !yield(response) {
				return
			}
		}
	}, nil
}

func (m *reconcileStorage) ReadResource(_ context.Context, request *resourcepb.ReadRequest) *BackendReadResponse {
	return m.readOne(request)
}

func (m *reconcileStorage) readOne(request *resourcepb.ReadRequest) *BackendReadResponse {
	key := request.GetKey()
	m.read = append(m.read, key.GetName())

	src := NamespacedResource{Namespace: key.GetNamespace(), Group: key.GetGroup(), Resource: key.GetResource()}
	rv := m.storedRV(src, key.GetName())
	if rv == 0 {
		return &BackendReadResponse{Error: &resourcepb.ErrorResult{Message: "not found", Code: 404}}
	}
	value := testObjectJSON(key.GetName(), key.GetName())
	if m.broken[key.GetName()] {
		value = []byte("not an object")
	}
	return &BackendReadResponse{
		Key:             key,
		ResourceVersion: rv,
		Value:           value,
	}
}

// storedRV is zero when storage does not hold the object.
func (m *reconcileStorage) storedRV(src NamespacedResource, name string) int64 {
	for _, stored := range m.live[src] {
		if stored == name {
			if rv := m.listRVs[src]; rv > 0 {
				return rv
			}
			return 1
		}
	}
	return 0
}

func repairServer(t *testing.T, storage StorageBackend, refs map[schema.GroupResource][]DocumentRef) (*searchServer, *MockResourceIndex) {
	t.Helper()
	idx := &MockResourceIndex{documentRefs: refs}
	search := &mockSearchBackend{cache: map[NamespacedResource]ResourceIndex{GlobalSearchKey("ns"): idx}}
	return globalTestServer(t, storage, search), idx
}

func TestReconcileIndexesWhatIsMissing(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a", "dash-b"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 20},
	}}
	// The index holds one of the two, at the current version.
	server, idx := repairServer(t, storage, map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: {{Name: "dash-a", RV: 20}},
	})

	res, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, 1, res.Reindexed)
	assert.Equal(t, 0, res.Removed)

	// Only the missing one was read, and only it was written.
	assert.Equal(t, []string{"dash-b"}, storage.read)
	assert.Equal(t, map[NamespacedResource][]string{
		dashboardType("ns"): {"dash-b"},
	}, indexedNames(t, idx))
}

func TestReconcileIndexesWhatIsOutOfDate(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 30},
	}}
	// Present, but indexed at an older version than storage holds.
	server, idx := repairServer(t, storage, map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: {{Name: "dash-a", RV: 20}},
	})

	res, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, 1, res.Reindexed)
	assert.Equal(t, []string{"dash-a"}, storage.read)
}

// No readable version means out of date, not current.
func TestReconcileIndexesWhatHasNoVersion(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 30},
	}}
	server, idx := repairServer(t, storage, map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: {{Name: "dash-a"}},
	})

	res, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, 1, res.Reindexed)
}

func TestReconcileRemovesWhatStorageNoLongerHas(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 20},
	}}
	// A delete the index never heard about.
	server, idx := repairServer(t, storage, map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: {{Name: "dash-a", RV: 20}, {Name: "gone", RV: 19}},
	})

	res, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, 0, res.Reindexed)
	assert.Equal(t, 1, res.Removed)

	items := idx.indexedItems()
	require.Len(t, items, 1)
	assert.Equal(t, ActionDelete, items[0].Action)
	assert.Equal(t, "gone", items[0].Key.GetName())
	assert.Empty(t, storage.read, "nothing has to be read to remove a document")
}

// An agreeing index costs no reads or writes.
func TestReconcileDoesNothingWhenTheIndexAgrees(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a", "dash-b"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 20},
	}}
	server, idx := repairServer(t, storage, map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: {{Name: "dash-a", RV: 20}, {Name: "dash-b", RV: 20}},
	})

	res, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, 0, res.Reindexed)
	assert.Equal(t, 0, res.Removed)
	assert.Empty(t, storage.read)
	assert.Empty(t, idx.indexedItems())
}

// The listing is older than the index, so a newer indexed version is kept.
func TestReconcileLeavesNewerDocumentsAlone(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 20},
	}}
	server, idx := repairServer(t, storage, map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: {{Name: "dash-a", RV: 25}},
	})

	res, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, 0, res.Reindexed)
	assert.Equal(t, 0, res.Removed)
}

// A backend without batch reads still gets its objects read, one at a time.
func TestReconcileReadsOneAtATimeWhenBatchesAreUnsupported(t *testing.T) {
	storage := &reconcileStorage{
		multiTypeStorage: multiTypeStorage{
			live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a", "dash-b"}},
			listRVs: map[NamespacedResource]int64{dashboardType("ns"): 20},
		},
		noBatchReads: true,
	}
	server, idx := repairServer(t, storage, nil)

	res, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, 2, res.Reindexed)
	assert.Equal(t, []string{"dash-a", "dash-b"}, storage.read)
}

// One unreadable object does not stop the rest of the repair.
func TestReconcileSkipsWhatItCannotRead(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 20},
	}}
	server, idx := repairServer(t, storage, nil)

	// The listing reports it, but by the time it is read it is gone.
	storage.afterList = func() { storage.live[dashboardType("ns")] = nil }

	_, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, []string{"dash-a"}, storage.read, "it was found out of date and read")
	assert.Empty(t, idx.indexedItems())
}

// A storage failure is returned, not mistaken for a deleted object, so the caller
// retries.
func TestReconcileReturnsStorageFailures(t *testing.T) {
	storage := &reconcileStorage{
		multiTypeStorage: multiTypeStorage{
			live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a", "dash-b"}},
			listRVs: map[NamespacedResource]int64{dashboardType("ns"): 20},
		},
		readErr: errors.New("storage is unavailable"),
	}
	server, idx := repairServer(t, storage, nil)

	_, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.Error(t, err)
	assert.Empty(t, idx.indexedItems())
}

// A build failure does not stop a reconcile, and the next one retries it. This is
// the repair for changes the update path moves past.
func TestReconcileRetriesWhatFailedToBuild(t *testing.T) {
	storage := &reconcileStorage{
		multiTypeStorage: multiTypeStorage{
			live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a", "dash-b"}},
			listRVs: map[NamespacedResource]int64{dashboardType("ns"): 20},
		},
	}
	storage.broken = map[string]bool{"dash-b": true}
	server, idx := repairServer(t, storage, nil)

	res, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, 1, res.Reindexed, "only what was written counts")
	assert.Equal(t, 1, res.Failed, "and the one that could not be built is reported")
	assert.Equal(t, map[NamespacedResource][]string{
		dashboardType("ns"): {"dash-a"},
	}, indexedNames(t, idx), "the one that failed is left out")

	// Once it builds, the next reconcile finds it still missing and indexes it.
	storage.broken = nil
	idx.documentRefs = map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: {{Name: "dash-a", RV: 20}},
	}
	idx.bulkItems = nil
	res, err = server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, map[NamespacedResource][]string{
		dashboardType("ns"): {"dash-b"},
	}, indexedNames(t, idx))
}

// Standard fields only, as on every other path into this index.
func TestReconcileKeepsStandardFieldsOnly(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 20},
	}}
	server, idx := repairServer(t, storage, nil)

	_, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)

	items := idx.indexedItems()
	require.Len(t, items, 1)
	require.NotNil(t, items[0].Doc)
	assert.Empty(t, items[0].Doc.Fields)
	assert.Empty(t, items[0].Doc.SelectableFields)
}

var (
	dashboardsGroupResource = schema.GroupResource{Group: "dashboard.grafana.app", Resource: "dashboards"}
)

// A document created and indexed after the listing is live and must be kept.
func TestReconcileDoesNotRemoveADocumentIndexedAfterTheListing(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 20},
	}}
	server, idx := repairServer(t, storage, map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: {{Name: "dash-a", RV: 20}},
	})
	storage.afterList = func() {
		// Created in storage and indexed, both after the listing was taken.
		storage.live[dashboardType("ns")] = append(storage.live[dashboardType("ns")], "late")
		idx.documentRefs[dashboardsGroupResource] = append(idx.documentRefs[dashboardsGroupResource], DocumentRef{Name: "late", RV: 21})
	}

	res, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, 0, res.Removed)
	assert.Empty(t, idx.indexedItems())
}

// Reads are chunked, but writes are not split per read chunk: each write has a
// fixed cost.
func TestReconcileWritesInFullBatches(t *testing.T) {
	names := make([]string, 0, 3*reconcileReadChunkSize)
	for i := range 3 * reconcileReadChunkSize {
		names = append(names, fmt.Sprintf("dash-%03d", i))
	}
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): names},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 20},
	}}
	server, idx := repairServer(t, storage, nil)

	res, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, len(names), res.Reindexed)
	assert.Equal(t, 1, idx.bulkCalls)
}

// Large removals are split into normal-sized writes.
func TestReconcileRemovesInBatches(t *testing.T) {
	gone := make([]DocumentRef, 0, maxBatchSize+1)
	for i := range maxBatchSize + 1 {
		gone = append(gone, DocumentRef{Name: fmt.Sprintf("gone-%d", i), RV: 1})
	}
	server, idx := repairServer(t, &reconcileStorage{}, map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: gone,
	})

	res, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, maxBatchSize+1, res.Removed)
	assert.Equal(t, 2, idx.bulkCalls)
}

// An import can restore older versions, so a rebuild rewrites everything and
// removes what the import dropped.
func TestRebuildTypeRewritesTheWholeType(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a", "dash-b"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 50},
	}}
	server, idx := repairServer(t, storage, map[schema.GroupResource][]DocumentRef{
		// Newer than the restored version, and one the import dropped.
		dashboardsGroupResource: {{Name: "dash-a", RV: 100}, {Name: "gone", RV: 90}},
	})

	res, err := server.rebuildResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, repairResult{Reindexed: 2, Removed: 1}, res)

	var written, removed []string
	for _, item := range idx.indexedItems() {
		if item.Action == ActionDelete {
			removed = append(removed, item.Key.GetName())
			continue
		}
		written = append(written, item.Doc.Key.GetName())
	}
	assert.Equal(t, []string{"dash-a", "dash-b"}, written)
	assert.Equal(t, []string{"gone"}, removed)
	assert.Empty(t, storage.read, "bodies come from the listing, not from reads one by one")
}

// The old document may describe what the import replaced, so it is removed.
func TestRebuildTypeRemovesWhatFailsToBuild(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a", "dash-b"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 50},
	}}
	storage.broken = map[string]bool{"dash-b": true}
	server, idx := repairServer(t, storage, map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: {{Name: "dash-a", RV: 40}, {Name: "dash-b", RV: 40}},
	})

	res, err := server.rebuildResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, repairResult{Reindexed: 1, Removed: 1, Failed: 1}, res)
}

// Same ordering guarantee as a reconcile.
func TestRebuildTypeDoesNotRemoveADocumentIndexedAfterTheListing(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 50},
	}}
	server, idx := repairServer(t, storage, map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: {{Name: "dash-a", RV: 50}},
	})
	storage.afterList = func() {
		storage.live[dashboardType("ns")] = append(storage.live[dashboardType("ns")], "late")
		idx.documentRefs[dashboardsGroupResource] = append(idx.documentRefs[dashboardsGroupResource], DocumentRef{Name: "late", RV: 51})
	}

	res, err := server.rebuildResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("ns"))
	require.NoError(t, err)
	assert.Equal(t, 0, res.Removed)
}

func TestRebuildTypeRefusesAPerResourceIndex(t *testing.T) {
	server, idx := repairServer(t, &reconcileStorage{}, nil)

	_, err := server.rebuildResourceType(t.Context(), idx, dashboardType("ns"), dashboardType("ns"))
	require.Error(t, err)
	assert.Empty(t, idx.indexedItems())
}

// Comparing with live objects would remove a per-resource index's trash.
func TestReconcileRefusesAPerResourceIndex(t *testing.T) {
	server, idx := repairServer(t, &reconcileStorage{}, nil)

	_, err := server.reconcileResourceType(t.Context(), idx, dashboardType("ns"), dashboardType("ns"))
	require.Error(t, err)
	assert.Empty(t, idx.indexedItems())
}

func TestReconcileRefusesAnotherNamespace(t *testing.T) {
	server, idx := repairServer(t, &reconcileStorage{}, nil)

	_, err := server.reconcileResourceType(t.Context(), idx, GlobalSearchKey("ns"), dashboardType("other"))
	require.Error(t, err)
	assert.Empty(t, idx.indexedItems())
}
