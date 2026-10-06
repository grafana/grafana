package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"net/http"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	dto "github.com/prometheus/client_model/go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
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
	}
	search := &mockSearchBackend{}
	server := globalTestServer(t, storage, search)

	global, err := server.build(t.Context(), GlobalSearchKey("ns"), 1, "test", false, time.Time{})
	require.NoError(t, err)
	built := global.(*MockResourceIndex).indexedItems()
	require.Len(t, built, 1)
	assert.Empty(t, built[0].Doc.Fields, "the build drops them")

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
	// Answers one more batch read than was asked for, as a misbehaving reader would.
	extraBatchResponse bool
	// Titles of stored objects, by name, where a test needs to tell versions apart.
	titles map[string]string
}

func (m *reconcileStorage) ListIterator(ctx context.Context, req *resourcepb.ListRequest, cb func(ListIterator) error) (int64, error) {
	rv, err := m.multiTypeStorage.ListIterator(ctx, req, cb)
	if m.afterList != nil {
		m.afterList()
	}
	return rv, err
}

func (m *reconcileStorage) BatchReadResource(_ context.Context, requests []*resourcepb.ReadRequest, _ bool) (iter.Seq[*BackendReadResponse], error) {
	if m.readErr != nil {
		return nil, m.readErr
	}
	if m.noBatchReads {
		return nil, ErrBatchReadUnsupported
	}
	responses := make([]*BackendReadResponse, 0, len(requests)+1)
	for _, request := range requests {
		responses = append(responses, m.readOne(request))
	}
	if m.extraBatchResponse && len(responses) > 0 {
		responses = append(responses, responses[0])
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
	title := key.GetName()
	if t, ok := m.titles[key.GetName()]; ok {
		title = t
	}
	value := testObjectJSON(key.GetName(), title)
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
	foldersGroupResource    = schema.GroupResource{Group: "folder.grafana.app", Resource: "folders"}
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
	names := make([]string, 0, 3*readChunkSize)
	for i := range 3 * readChunkSize {
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

// importedAt is what storage reports as the last import of dashboards and folders
// in namespace ns.
func importedAt(dashboards, folders time.Time) []ResourceLastImportTime {
	var out []ResourceLastImportTime
	if !dashboards.IsZero() {
		out = append(out, ResourceLastImportTime{NamespacedResource: dashboardType("ns"), LastImportTime: dashboards})
	}
	if !folders.IsZero() {
		out = append(out, ResourceLastImportTime{NamespacedResource: folderType("ns"), LastImportTime: folders})
	}
	return out
}

// heldAt is what an index holding both covered types records, with the import
// time it caught up with for each, zero for none.
func heldAt(dashboards, folders time.Time) map[schema.GroupResource]TypeBuild {
	return map[schema.GroupResource]TypeBuild{dashboardsGroupResource: {StorageImportTime: dashboards}, foldersGroupResource: {StorageImportTime: folders}}
}

var (
	importMonday  = time.Date(2026, 9, 28, 10, 0, 0, 0, time.UTC)
	importTuesday = importMonday.Add(24 * time.Hour)
)

// A build records every type it indexed, with the import each has, so a restart
// neither rebuilds types the index caught up with nor takes them for new ones.
func TestGlobalIndexBuildRecordsCompletedTypeBuilds(t *testing.T) {
	storage := &multiTypeStorage{
		live: map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}, folderType("ns"): {"folder-a"}},
	}
	storage.lastImportTimes = importedAt(importMonday, time.Time{})
	server := globalTestServer(t, storage, &mockSearchBackend{})

	idx, err := server.build(t.Context(), GlobalSearchKey("ns"), 2, "test", false, time.Time{})
	require.NoError(t, err)

	builds, err := idx.CompletedTypeBuilds()
	require.NoError(t, err)
	assert.Equal(t, heldAt(importMonday, time.Time{}), builds, "a type never imported is recorded too")
}

// An import into one type rebuilds that type, not the whole index, and records it.
func TestImportRebuildsOnlyTheImportedType(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}, folderType("ns"): {"folder-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 50, folderType("ns"): 50},
	}}
	storage.lastImportTimes = importedAt(importTuesday, importMonday)
	server, idx := repairServer(t, storage, nil)
	idx.completedTypeBuilds = heldAt(importMonday, importMonday)

	require.NoError(t, server.syncTypes(t.Context(), GlobalSearchKey("ns"), nil))

	assert.Equal(t, map[NamespacedResource][]string{
		dashboardType("ns"): {"dash-a"},
	}, indexedNames(t, idx), "folders were not imported again, so they are left alone")
	assert.Equal(t, importTuesday, idx.completedTypeBuilds[dashboardsGroupResource].StorageImportTime)
}

// Nothing is done when storage reports the import the index already caught up
// with, or no import at all.
func TestImportCheckLeavesCaughtUpTypesAlone(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live: map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}, folderType("ns"): {"folder-a"}},
	}}
	storage.lastImportTimes = importedAt(importMonday, time.Time{})
	server, idx := repairServer(t, storage, nil)
	idx.completedTypeBuilds = heldAt(importMonday, time.Time{})

	require.NoError(t, server.syncTypes(t.Context(), GlobalSearchKey("ns"), nil))
	assert.Empty(t, idx.indexedItems())
	assert.Empty(t, storage.listed)
}

// An object that cannot be built would fail again, so it does not keep the type
// unrecorded, which would rebuild it at every check.
func TestImportCheckRecordsDespiteObjectsThatCannotBeBuilt(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a", "dash-b"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 50},
	}}
	storage.broken = map[string]bool{"dash-b": true}
	storage.lastImportTimes = importedAt(importTuesday, time.Time{})
	server, idx := repairServer(t, storage, nil)
	idx.completedTypeBuilds = heldAt(importMonday, time.Time{})

	require.NoError(t, server.syncTypes(t.Context(), GlobalSearchKey("ns"), nil))
	assert.Equal(t, importTuesday, idx.completedTypeBuilds[dashboardsGroupResource].StorageImportTime)
}

// A failure to read storage or the index is transient, so the import stays
// unrecorded and the next check tries again.
func TestImportCheckRetriesAfterAReadFailure(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 50},
	}}
	storage.lastImportTimes = importedAt(importTuesday, time.Time{})
	server, idx := repairServer(t, storage, nil)
	idx.completedTypeBuilds = heldAt(importMonday, time.Time{})
	idx.documentRefsErr = errors.New("index unavailable")

	require.Error(t, server.syncTypes(t.Context(), GlobalSearchKey("ns"), nil))
	assert.Equal(t, importMonday, idx.completedTypeBuilds[dashboardsGroupResource].StorageImportTime, "not recorded")

	idx.documentRefsErr = nil
	require.NoError(t, server.syncTypes(t.Context(), GlobalSearchKey("ns"), nil))
	assert.Equal(t, importTuesday, idx.completedTypeBuilds[dashboardsGroupResource].StorageImportTime)
}

// An import no longer rebuilds the whole global index: its reserved key is never
// imported, so the rebuild scan sees no import for it.
func TestImportDoesNotRebuildTheGlobalIndex(t *testing.T) {
	storage := &mockStorageBackend{lastImportTimes: importedAt(importTuesday, importTuesday)}
	s := &searchServer{storage: storage}

	times, err := s.getLastImportTimes(t.Context(), []NamespacedResource{GlobalSearchKey("ns")})
	require.NoError(t, err)
	assert.True(t, times[GlobalSearchKey("ns")].IsZero())
}

// The scan queues only the types storage reports as imported since the index
// caught up, so the rebuild workers, not the scan, do the work.
func TestImportQueuesARebuildOfOnlyTheImportedType(t *testing.T) {
	storage := &reconcileStorage{}
	storage.lastImportTimes = importedAt(importTuesday, importMonday)
	server, idx := repairServer(t, storage, nil)
	idx.completedTypeBuilds = heldAt(importMonday, importMonday)

	completeChs, err := server.queueTypeSyncs(t.Context(), []NamespacedResource{GlobalSearchKey("ns"), dashboardType("ns")}, nil)
	require.NoError(t, err)

	queued := server.rebuildQueue.Elements()
	require.Len(t, queued, 1)
	assert.Equal(t, GlobalSearchKey("ns"), queued[0].NamespacedResource)
	assert.Equal(t, []schema.GroupResource{dashboardsGroupResource}, queued[0].staleTypes)
	assert.Len(t, completeChs, 1, "so an explicit rebuild can wait for it")
}

func TestImportQueuesNothingWhenCaughtUp(t *testing.T) {
	storage := &reconcileStorage{}
	storage.lastImportTimes = importedAt(importMonday, time.Time{})
	server, idx := repairServer(t, storage, nil)
	idx.completedTypeBuilds = heldAt(importMonday, time.Time{})

	_, err := server.queueTypeSyncs(t.Context(), []NamespacedResource{GlobalSearchKey("ns")}, nil)
	require.NoError(t, err)
	assert.Zero(t, server.rebuildQueue.Len())
}

// Two requests for the same index before its turn are one rebuild covering both
// types.
func TestRebuildRequestsCombineImportedTypes(t *testing.T) {
	folders := foldersGroupResource
	a := rebuildRequest{NamespacedResource: GlobalSearchKey("ns"), staleTypes: []schema.GroupResource{dashboardsGroupResource}}
	b := rebuildRequest{NamespacedResource: GlobalSearchKey("ns"), staleTypes: []schema.GroupResource{folders, dashboardsGroupResource}}

	c, ok := combineRebuildRequests(a, b)
	require.True(t, ok)
	assert.Equal(t, []schema.GroupResource{dashboardsGroupResource, folders}, c.staleTypes)
}

// A worker given imported types rebuilds just those when no full rebuild is due.
func TestRebuildWorkerRebuildsOnlyImportedTypes(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}, folderType("ns"): {"folder-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 50, folderType("ns"): 50},
	}}
	storage.lastImportTimes = importedAt(importTuesday, time.Time{})
	server, idx := repairServer(t, storage, nil)
	// Current, so nothing but the import calls for a rebuild.
	idx.buildInfo = IndexBuildInfo{BuildTime: time.Now(), Features: CurrentIndexFeatures()}

	server.rebuildIndex(t.Context(), rebuildRequest{
		NamespacedResource: GlobalSearchKey("ns"),
		staleTypes:         []schema.GroupResource{dashboardsGroupResource},
	})

	assert.Equal(t, map[NamespacedResource][]string{
		dashboardType("ns"): {"dash-a"},
	}, indexedNames(t, idx), "folders were not imported, so they are not rewritten")
	assert.Equal(t, importTuesday, idx.completedTypeBuilds[dashboardsGroupResource].StorageImportTime)
}

// When a full rebuild is due anyway it wins: it rewrites every type, imported or
// not.
func TestRebuildWorkerPrefersAFullRebuildWhenDue(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live: map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
	}}
	storage.lastImportTimes = importedAt(importTuesday, time.Time{})
	search := &mockSearchBackend{}
	server := globalTestServer(t, storage, search)
	idx := &MockResourceIndex{buildInfo: IndexBuildInfo{BuildTime: importMonday, Features: CurrentIndexFeatures()}}
	search.cache = map[NamespacedResource]ResourceIndex{GlobalSearchKey("ns"): idx}

	server.rebuildIndex(t.Context(), rebuildRequest{
		NamespacedResource: GlobalSearchKey("ns"),
		minBuildTime:       importTuesday, // built before this, so a full rebuild is due
		staleTypes:         []schema.GroupResource{dashboardsGroupResource},
	})

	require.Len(t, search.buildIndexCalls, 1)
	assert.Equal(t, GlobalSearchKey("ns"), search.buildIndexCalls[0].key)
	assert.Empty(t, idx.indexedItems(), "the old index is replaced, not written to")
}

// An explicit rebuild of a global index catches up with imports of its covered
// types, and waits for it, as it did before only those types were rebuilt.
func TestRebuildIndexesCatchesUpAGlobalIndexWithImports(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 50},
	}}
	storage.lastImportTimes = importedAt(importTuesday, time.Time{})
	server, idx := repairServer(t, storage, nil)
	// Current in every other way, so only the import calls for work.
	idx.buildInfo = IndexBuildInfo{BuildTime: time.Now(), Features: CurrentIndexFeatures(), SearchFieldsHash: GlobalSearchFieldsHash()}
	require.NoError(t, server.init(t.Context()))
	t.Cleanup(server.stop)

	rsp, err := server.RebuildIndexes(t.Context(), &resourcepb.RebuildIndexesRequest{
		Namespace: "ns",
		Keys:      []*resourcepb.ResourceKey{{Namespace: "ns", Group: GlobalSearchGroup, Resource: GlobalSearchResource}},
	})
	require.NoError(t, err)
	require.Nil(t, rsp.Error)
	assert.Equal(t, int64(1), rsp.RebuildCount)
	assert.Equal(t, importTuesday, idx.completedTypeBuilds[dashboardsGroupResource].StorageImportTime, "caught up before it returned")
}

// An explicit rebuild that cannot check a global index for imports reports it,
// rather than claiming it rebuilt nothing.
func TestRebuildIndexesReportsAFailedImportCheck(t *testing.T) {
	server, idx := repairServer(t, &reconcileStorage{}, nil)
	idx.completedTypeBuildsErr = errors.New("index unavailable")

	rsp, err := server.RebuildIndexes(t.Context(), &resourcepb.RebuildIndexesRequest{
		Namespace: "ns",
		Keys:      []*resourcepb.ResourceKey{{Namespace: "ns", Group: GlobalSearchGroup, Resource: GlobalSearchResource}},
	})
	require.NoError(t, err)
	require.NotNil(t, rsp.Error)
	assert.Contains(t, rsp.Error.Message, "index unavailable")
}

// Only a newer import counts, as for a per-resource index. An older time than
// the one recorded does not rebuild the type.
func TestImportCheckIgnoresAnOlderImportTime(t *testing.T) {
	storage := &reconcileStorage{}
	storage.lastImportTimes = importedAt(importMonday, time.Time{})
	server, idx := repairServer(t, storage, nil)
	idx.completedTypeBuilds = heldAt(importTuesday, time.Time{})

	completeChs, err := server.queueTypeSyncs(t.Context(), []NamespacedResource{GlobalSearchKey("ns")}, nil)
	require.NoError(t, err)
	assert.Empty(t, completeChs)
	assert.Zero(t, server.rebuildQueue.Len())
}

// A type rebuild replays no events first: a global index has none to replay.
func TestImportedTypeRebuildDoesNotUpdateTheIndex(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 50},
	}}
	storage.lastImportTimes = importedAt(importTuesday, time.Time{})
	server, idx := repairServer(t, storage, nil)

	require.NoError(t, server.syncTypes(t.Context(), GlobalSearchKey("ns"), nil))
	assert.Zero(t, idx.updateIndexCalls)
	assert.Equal(t, importTuesday, idx.completedTypeBuilds[dashboardsGroupResource].StorageImportTime)
}

// watchStorage hands out one stream of written keys a test controls.
type watchStorage struct {
	reconcileStorage

	keys chan *resourcepb.ResourceKey
	// The watch stream, for a backend that cannot report written keys.
	events chan *WrittenEvent
	// Types asked for, and the reconnect callback, so a test can check them,
	// guarded by mu: the watch runs in its own goroutine.
	mu          sync.Mutex
	types       []schema.GroupResource
	onReconnect func()
	err         error
}

func (m *watchStorage) WatchWrittenKeys(_ context.Context, types []schema.GroupResource, onReconnect func()) (<-chan *resourcepb.ResourceKey, error) {
	if m.err != nil {
		return nil, m.err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.types = types
	m.onReconnect = onReconnect
	return m.keys, nil
}

func (m *watchStorage) WatchWriteEvents(context.Context) (<-chan *WrittenEvent, error) {
	return m.events, nil
}

func (m *watchStorage) onReconnectSet() bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.onReconnect != nil
}

func (m *watchStorage) watchedTypes() []schema.GroupResource {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.types
}

func (m *watchStorage) reconnect() {
	m.mu.Lock()
	onReconnect := m.onReconnect
	m.mu.Unlock()
	onReconnect()
}

func writtenKey(key NamespacedResource, name string) *resourcepb.ResourceKey {
	return &resourcepb.ResourceKey{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource, Name: name}
}

// A written key names an object; its current state is read from storage and
// written, and nothing is replayed.
func TestWatchWritesTheCurrentStateOfNotifiedObjects(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 50},
	}}
	server, idx := repairServer(t, storage, nil)

	server.applyWrittenKeys(t.Context(), []*resourcepb.ResourceKey{
		writtenKey(dashboardType("ns"), "dash-a"),
		writtenKey(folderType("ns"), "folder-a"),
	})

	items := idx.indexedItems()
	require.Len(t, items, 2)
	assert.Equal(t, ActionIndex, items[0].Action)
	assert.Equal(t, "dash-a", items[0].Doc.Key.Name)
	assert.Empty(t, items[0].Doc.Fields, "standard fields only")
	assert.Equal(t, ActionDelete, items[1].Action)
	assert.Equal(t, "folder-a", items[1].Key.Name)
	assert.Zero(t, idx.updateIndexCalls, "nothing is replayed from the event log")
}

// A late create for an object deleted since then must not bring it back.
func TestWatchLateCreateOfADeletedObjectRemovesIt(t *testing.T) {
	server, idx := repairServer(t, &reconcileStorage{}, nil)

	server.applyWrittenKeys(t.Context(), []*resourcepb.ResourceKey{
		writtenKey(dashboardType("ns"), "dash-gone"),
	})

	items := idx.indexedItems()
	require.Len(t, items, 1)
	assert.Equal(t, ActionDelete, items[0].Action)
}

// Several notifications for one object in a batch are one read and one write.
func TestWatchReadsEachObjectOnce(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live: map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
	}}
	server, idx := repairServer(t, storage, nil)

	server.applyWrittenKeys(t.Context(), []*resourcepb.ResourceKey{
		writtenKey(dashboardType("ns"), "dash-a"),
		writtenKey(dashboardType("ns"), "dash-a"),
	})

	assert.Equal(t, []string{"dash-a"}, storage.read)
	assert.Len(t, idx.indexedItems(), 1)
}

// An object that cannot be built is removed, so a reconcile sees it missing.
func TestWatchRemovesWhatFailsToBuild(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live: map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
	}}
	storage.broken = map[string]bool{"dash-a": true}
	server, idx := repairServer(t, storage, nil)

	server.applyWrittenKeys(t.Context(), []*resourcepb.ResourceKey{
		writtenKey(dashboardType("ns"), "dash-a"),
	})

	items := idx.indexedItems()
	require.Len(t, items, 1)
	assert.Equal(t, ActionDelete, items[0].Action)
}

// When storage cannot be read, nothing is written, so the index is not changed
// on a guess; a reconcile repairs it.
func TestWatchWritesNothingWhenStorageFails(t *testing.T) {
	storage := &reconcileStorage{readErr: errors.New("storage unavailable")}
	server, idx := repairServer(t, storage, nil)

	server.applyWrittenKeys(t.Context(), []*resourcepb.ResourceKey{
		writtenKey(dashboardType("ns"), "dash-a"),
	})

	assert.Empty(t, idx.indexedItems())
}

func TestWatchIgnoresWhatTheIndexDoesNotCover(t *testing.T) {
	storage := &reconcileStorage{}
	server, idx := repairServer(t, storage, nil)

	playlists := NamespacedResource{Namespace: "ns", Group: "playlist.grafana.app", Resource: "playlists"}
	server.applyWrittenKeys(t.Context(), []*resourcepb.ResourceKey{
		writtenKey(playlists, "my-playlist"),
		// Another namespace, which this instance holds no index for.
		writtenKey(dashboardType("other"), "not-mine"),
	})

	assert.Empty(t, storage.read, "nothing read for what no open index here covers")
	assert.Empty(t, idx.indexedItems())
}

// Keys are taken until the watch is cancelled; the stream itself never ends.
func TestWatchAppliesKeysUntilCancelled(t *testing.T) {
	storage := &watchStorage{keys: make(chan *resourcepb.ResourceKey, 4)}
	storage.live = map[NamespacedResource][]string{dashboardType("ns"): {"dash-a", "dash-b"}}
	server, idx := repairServer(t, storage, nil)
	ctx, cancel := context.WithCancel(t.Context())

	storage.keys <- writtenKey(dashboardType("ns"), "dash-a")
	storage.keys <- writtenKey(dashboardType("ns"), "dash-b")
	done := make(chan struct{})
	go func() {
		defer close(done)
		server.runGlobalIndexWatch(ctx)
	}()
	require.Eventually(t, func() bool { return len(idx.indexedItems()) == 2 }, 5*time.Second, 10*time.Millisecond)
	cancel()
	<-done

	assert.Equal(t, map[NamespacedResource][]string{dashboardType("ns"): {"dash-a", "dash-b"}}, indexedNames(t, idx))
}

// Keys arriving shortly after the first go into one batch, so a burst of
// writes is one read and one write rather than one each. A key arriving later
// starts the next batch.
func TestWatchBatchesKeysArrivingTogether(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		keys := make(chan *resourcepb.ResourceKey, 3)
		keys <- writtenKey(dashboardType("ns"), "dash-a")
		go func() {
			time.Sleep(globalWatchBatchWait / 2)
			keys <- writtenKey(dashboardType("ns"), "dash-b")
			time.Sleep(globalWatchBatchWait)
			keys <- writtenKey(dashboardType("ns"), "dash-c")
		}()

		batch, ok := nextWrittenKeysBatch(t.Context(), keys)
		require.True(t, ok)
		assert.Len(t, batch, 2)
		batch, ok = nextWrittenKeysBatch(t.Context(), keys)
		require.True(t, ok)
		assert.Len(t, batch, 1)
	})
}

// Keys can be lost before a watch is ready, as while the bus is unreachable,
// and while it is disconnected, so every open global index this instance owns is
// reconciled once the watch is ready and again after a reconnect.
func TestWatchReconcilesOwnedIndexesWhenReadyAndOnReconnect(t *testing.T) {
	storage := &watchStorage{keys: make(chan *resourcepb.ResourceKey)}
	server, _ := repairServer(t, storage, nil)
	server.search.(*mockSearchBackend).openIndexes = []NamespacedResource{GlobalSearchKey("ns"), dashboardType("ns")}
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan struct{})
	go func() {
		defer close(done)
		server.runGlobalIndexWatch(ctx)
	}()
	require.Eventually(t, func() bool { return server.rebuildQueue.Len() == 1 }, 5*time.Second, 10*time.Millisecond, "queued once ready")
	assert.Equal(t, GlobalSearchResourceTypes(), storage.watchedTypes())
	req, err := server.rebuildQueue.Next(ctx)
	require.NoError(t, err)
	assert.Equal(t, GlobalSearchKey("ns"), req.NamespacedResource)
	assert.True(t, req.reconcile)

	storage.reconnect()
	require.Eventually(t, func() bool { return server.rebuildQueue.Len() == 1 }, 5*time.Second, 10*time.Millisecond, "queued again after a reconnect")
	cancel()
	<-done
}

// A backend that cannot report written keys is followed through its watch
// stream instead, which is slower but still live.
func TestWatchFallsBackToTheWatchStream(t *testing.T) {
	storage := &watchStorage{err: ErrWrittenKeysUnsupported, events: make(chan *WrittenEvent, 1)}
	storage.live = map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}}
	server, idx := repairServer(t, storage, nil)
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan struct{})
	go func() {
		defer close(done)
		server.runGlobalIndexWatch(ctx)
	}()

	storage.events <- &WrittenEvent{Type: resourcepb.WatchEvent_MODIFIED, Key: writtenKey(dashboardType("ns"), "dash-a")}
	require.Eventually(t, func() bool { return len(idx.indexedItems()) == 1 }, 5*time.Second, 10*time.Millisecond)
	cancel()
	<-done
}

func TestSearchDoesNotWaitForGlobalIndex(t *testing.T) {
	global := GlobalSearchKey("ns")
	dashboards := NamespacedResource{Namespace: "ns", Group: "dashboard.grafana.app", Resource: "dashboards"}

	globalIdx := &MockResourceIndex{}
	dashboardsIdx := &MockResourceIndex{}
	backend := &mockSearchBackend{
		cache: map[NamespacedResource]ResourceIndex{
			global:     globalIdx,
			dashboards: dashboardsIdx,
		},
	}
	s := &searchServer{
		search:             backend,
		log:                log.NewNopLogger(),
		indexMetrics:       ProvideIndexMetrics(nil),
		globalIndexEnabled: true,
	}

	idx, err := s.getOrCreateIndex(t.Context(), nil, global, "test")
	require.NoError(t, err)
	require.Equal(t, globalIdx, idx)
	// A global index is updated in the background, so the search reads
	// whatever it holds.
	assert.Equal(t, 0, globalIdx.updateIndexCalls)

	idx, err = s.getOrCreateIndex(t.Context(), nil, dashboards, "test")
	require.NoError(t, err)
	require.Equal(t, dashboardsIdx, idx)
	assert.Equal(t, 1, dashboardsIdx.updateIndexCalls)
}

// Fetching an index counts as using it, so notifications leave alone a global
// index another instance now owns, and it can be closed here.
func TestWatchSkipsAGlobalIndexOwnedElsewhere(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live: map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
	}}
	server, idx := repairServer(t, storage, nil)
	server.ownsIndexFn = func(NamespacedResource) (bool, error) { return false, nil }

	server.applyWrittenKeys(t.Context(), []*resourcepb.ResourceKey{
		writtenKey(dashboardType("ns"), "dash-a"),
	})

	assert.Empty(t, storage.read)
	assert.Empty(t, idx.indexedItems())
}

// A global index replays no events, not even when a search opens it.
func TestSearchNeverUpdatesAGlobalIndex(t *testing.T) {
	search := &mockSearchBackend{}
	server := globalTestServer(t, &multiTypeStorage{}, search)

	for range 2 {
		idx, err := server.getOrCreateIndex(t.Context(), nil, GlobalSearchKey("ns"), "test")
		require.NoError(t, err)
		assert.Zero(t, idx.(*MockResourceIndex).updateIndexCalls)
	}
}

// A global index reused from disk, or restored from a snapshot, missed what
// changed while it was closed, so it is reconciled at once, whatever its slot.
func TestReopenedGlobalIndexIsReconciledAtOnce(t *testing.T) {
	server := globalTestServer(t, &multiTypeStorage{}, &mockSearchBackend{reusesFromDisk: true})

	_, err := server.getOrCreateIndex(t.Context(), nil, GlobalSearchKey("ns"), "test")
	require.NoError(t, err)

	queued := server.rebuildQueue.Elements()
	require.Len(t, queued, 1)
	assert.Equal(t, GlobalSearchKey("ns"), queued[0].NamespacedResource)
	assert.True(t, queued[0].reconcile)
}

// One just built missed what changed after its listing, since notifications
// have nowhere to go until it is published, so it is reconciled too.
func TestFreshGlobalIndexIsReconciled(t *testing.T) {
	server := globalTestServer(t, &multiTypeStorage{}, &mockSearchBackend{})

	_, err := server.getOrCreateIndex(t.Context(), nil, GlobalSearchKey("ns"), "test")
	require.NoError(t, err)

	queued := server.rebuildQueue.Elements()
	require.Len(t, queued, 1)
	assert.True(t, queued[0].reconcile)
}

// A global index gets no updater, so it never asks storage for changes since a
// checkpoint.
func TestGlobalIndexIsBuiltWithoutAnUpdater(t *testing.T) {
	search := &mockSearchBackend{}
	server := globalTestServer(t, &multiTypeStorage{}, search)

	_, err := server.build(t.Context(), GlobalSearchKey("ns"), 1, "test", false, time.Time{})
	require.NoError(t, err)
	assert.Nil(t, search.lastUpdater)
}

// The reader can add an error of its own after the last response; that must not
// be taken for an object.
func TestWatchToleratesAnExtraReadResponse(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live: map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
	}}
	storage.extraBatchResponse = true
	server, idx := repairServer(t, storage, nil)

	server.applyWrittenKeys(t.Context(), []*resourcepb.ResourceKey{
		writtenKey(dashboardType("ns"), "dash-a"),
	})

	assert.Equal(t, map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}}, indexedNames(t, idx))
}

// A stream that never sends does not hold up shutdown.
func TestWatchStopsOnAnIdleStreamWhenCancelled(t *testing.T) {
	storage := &watchStorage{keys: make(chan *resourcepb.ResourceKey)}
	server := globalTestServer(t, storage, &mockSearchBackend{})
	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan struct{})
	go func() {
		defer close(done)
		server.runGlobalIndexWatch(ctx)
	}()
	require.Eventually(t, storage.onReconnectSet, 5*time.Second, 10*time.Millisecond)
	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("still waiting for a key after cancellation")
	}
}

var playlistsGroupResource = schema.GroupResource{Group: "playlist.grafana.app", Resource: "playlists"}

// A type added to what the index covers is indexed on its own and recorded,
// without rebuilding the types the index already holds.
func TestSyncIndexesANewlyCoveredType(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}, folderType("ns"): {"folder-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 50, folderType("ns"): 50},
	}}
	server, idx := repairServer(t, storage, nil)
	// Built when only dashboards were covered.
	idx.completedTypeBuilds = map[schema.GroupResource]TypeBuild{dashboardsGroupResource: {}}

	require.NoError(t, server.syncTypes(t.Context(), GlobalSearchKey("ns"), nil))

	assert.Equal(t, map[NamespacedResource][]string{folderType("ns"): {"folder-a"}}, indexedNames(t, idx))
	assert.Equal(t, heldAt(time.Time{}, time.Time{}), idx.completedTypeBuilds)
}

// A type dropped from what the index covers has its documents removed, and is
// forgotten, so it is not removed again.
func TestSyncRemovesATypeNoLongerCovered(t *testing.T) {
	server, idx := repairServer(t, &reconcileStorage{}, map[schema.GroupResource][]DocumentRef{
		playlistsGroupResource: {{Name: "playlist-b", RV: 40}, {Name: "playlist-a", RV: 40}},
	})
	idx.completedTypeBuilds = heldAt(time.Time{}, time.Time{})
	idx.completedTypeBuilds[playlistsGroupResource] = TypeBuild{StorageImportTime: importMonday}

	require.NoError(t, server.syncTypes(t.Context(), GlobalSearchKey("ns"), nil))

	items := idx.indexedItems()
	removed := make([]string, 0, len(items))
	for _, item := range items {
		require.Equal(t, ActionDelete, item.Action)
		assert.Equal(t, playlistsGroupResource, schema.GroupResource{Group: item.Key.Group, Resource: item.Key.Resource})
		removed = append(removed, item.Key.Name)
	}
	assert.Equal(t, []string{"playlist-a", "playlist-b"}, removed)
	assert.Equal(t, heldAt(time.Time{}, time.Time{}), idx.completedTypeBuilds)
	types, err := idx.DocumentTypes()
	require.NoError(t, err)
	assert.NotContains(t, types, playlistsGroupResource, "forgotten from both records")
}

// A removal that fails part way keeps the type recorded, so the next sync
// removes the rest.
func TestSyncRetriesARemovalThatFailedPartWay(t *testing.T) {
	refs := make([]DocumentRef, 0, maxBatchSize+1)
	for i := range maxBatchSize + 1 {
		refs = append(refs, DocumentRef{Name: fmt.Sprintf("playlist-%04d", i), RV: 40})
	}
	server, idx := repairServer(t, &reconcileStorage{}, map[schema.GroupResource][]DocumentRef{playlistsGroupResource: refs})
	idx.completedTypeBuilds = heldAt(time.Time{}, time.Time{})
	idx.completedTypeBuilds[playlistsGroupResource] = TypeBuild{}
	// The first batch of deletes goes through, the second fails.
	idx.failBulkFromCall = 2

	require.Error(t, server.syncTypes(t.Context(), GlobalSearchKey("ns"), nil))
	assert.Contains(t, idx.completedTypeBuilds, playlistsGroupResource, "still recorded")

	idx.failBulkFromCall = 0
	require.NoError(t, server.syncTypes(t.Context(), GlobalSearchKey("ns"), nil))
	assert.NotContains(t, idx.completedTypeBuilds, playlistsGroupResource)
}

// An index reused at startup is synced at once, not at the first tick of the
// rebuild scan.
func TestStartupSyncsTheTypesOfAReusedGlobalIndex(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{folderType("ns"): {"folder-a"}},
		listRVs: map[NamespacedResource]int64{folderType("ns"): 50},
	}}
	server, idx := repairServer(t, storage, nil)
	server.search.(*mockSearchBackend).openIndexes = []NamespacedResource{GlobalSearchKey("ns")}
	// Written when only dashboards were covered.
	idx.completedTypeBuilds = map[schema.GroupResource]TypeBuild{dashboardsGroupResource: {}}
	idx.buildInfo = IndexBuildInfo{BuildTime: time.Now(), Features: CurrentIndexFeatures(), SearchFieldsHash: GlobalSearchFieldsHash()}

	require.NoError(t, server.init(t.Context()))
	t.Cleanup(server.stop)

	require.Eventually(t, func() bool {
		builds, err := idx.CompletedTypeBuilds()
		require.NoError(t, err)
		_, ok := builds[foldersGroupResource]
		return ok
	}, 5*time.Second, 10*time.Millisecond, "folders were synced without waiting for the scan")
}

// The rebuild scan notices a coverage change the same way it notices an import.
func TestScanQueuesCoverageChanges(t *testing.T) {
	server, idx := repairServer(t, &reconcileStorage{}, nil)
	// Holds dashboards, and a type no longer covered, but not folders.
	idx.completedTypeBuilds = map[schema.GroupResource]TypeBuild{dashboardsGroupResource: {}, playlistsGroupResource: {}}

	_, err := server.queueTypeSyncs(t.Context(), []NamespacedResource{GlobalSearchKey("ns")}, nil)
	require.NoError(t, err)

	queued := server.rebuildQueue.Elements()
	require.Len(t, queued, 1)
	assert.ElementsMatch(t, []schema.GroupResource{foldersGroupResource, playlistsGroupResource}, queued[0].staleTypes)
}

// A type written only in part, as when a release that added it is rolled back
// mid-sync, is never recorded, but its documents are still found and removed.
func TestSyncRemovesAPartlyWrittenTypeNoLongerCovered(t *testing.T) {
	server, idx := repairServer(t, &reconcileStorage{}, map[schema.GroupResource][]DocumentRef{
		playlistsGroupResource: {{Name: "playlist-a", RV: 40}},
	})
	idx.completedTypeBuilds = heldAt(time.Time{}, time.Time{})

	require.NoError(t, server.syncTypes(t.Context(), GlobalSearchKey("ns"), nil))

	items := idx.indexedItems()
	require.Len(t, items, 1)
	assert.Equal(t, ActionDelete, items[0].Action)
	assert.Equal(t, "playlist-a", items[0].Key.Name)
}

// The API that serves this search is enabled separately, so a search before the
// index is enabled is answered as unavailable rather than as a server error.
func TestGlobalSearchIsUnavailableWhileTheIndexIsDisabled(t *testing.T) {
	server := globalTestServer(t, &multiTypeStorage{}, &mockSearchBackend{})
	server.globalIndexEnabled = false

	rsp, err := server.Search(t.Context(), &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{Key: &resourcepb.ResourceKey{Namespace: "ns", Group: GlobalSearchGroup, Resource: GlobalSearchResource}},
		Limit:   10,
	})
	require.NoError(t, err)
	require.NotNil(t, rsp.Error)
	assert.Equal(t, int32(http.StatusServiceUnavailable), rsp.Error.Code)
}

func TestRebuildRequestsCombineReconcile(t *testing.T) {
	a := rebuildRequest{NamespacedResource: GlobalSearchKey("ns"), staleTypes: []schema.GroupResource{dashboardsGroupResource}}
	b := rebuildRequest{NamespacedResource: GlobalSearchKey("ns"), reconcile: true}

	c, ok := combineRebuildRequests(a, b)
	require.True(t, ok)
	assert.True(t, c.reconcile)
	assert.Equal(t, []schema.GroupResource{dashboardsGroupResource}, c.staleTypes)
}

// A reconcile runs in the rebuild workers, so it never overlaps a rebuild of
// the same index, and repairs every covered type.
func TestRebuildWorkerReconcilesTheGlobalIndex(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}, folderType("ns"): {"folder-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 50, folderType("ns"): 50},
	}}
	// Missing folder-a, and still holding a dashboard deleted since.
	server, idx := repairServer(t, storage, map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: {{Name: "dash-a", RV: 50}, {Name: "dash-gone", RV: 40}},
	})
	idx.buildInfo = IndexBuildInfo{BuildTime: time.Now(), Features: CurrentIndexFeatures(), SearchFieldsHash: GlobalSearchFieldsHash()}

	server.rebuildIndex(t.Context(), rebuildRequest{NamespacedResource: GlobalSearchKey("ns"), reconcile: true})

	var indexed, removed []string
	for _, item := range idx.indexedItems() {
		if item.Action == ActionDelete {
			removed = append(removed, item.Key.Name)
		} else {
			indexed = append(indexed, item.Doc.Key.Name)
		}
	}
	assert.Equal(t, []string{"folder-a"}, indexed)
	assert.Equal(t, []string{"dash-gone"}, removed)
	assert.NotZero(t, idx.reconciledAt, "recorded, so it is not compared again for an interval")
}

// Only the global indexes this instance owns are reconciled here, and only
// once they are due.
func TestReconcileQueuesOnlyOwnedGlobalIndexes(t *testing.T) {
	server, _ := repairServer(t, &reconcileStorage{}, nil)
	search := server.search.(*mockSearchBackend)
	search.cache[GlobalSearchKey("elsewhere")] = &MockResourceIndex{}
	search.cache[dashboardType("ns")] = &MockResourceIndex{}
	server.ownsIndexFn = func(key NamespacedResource) (bool, error) { return key.Namespace == "ns", nil }

	server.queueDueReconciles([]NamespacedResource{GlobalSearchKey("ns"), GlobalSearchKey("elsewhere"), dashboardType("ns")}, time.Now())

	queued := server.rebuildQueue.Elements()
	require.Len(t, queued, 1)
	assert.Equal(t, GlobalSearchKey("ns"), queued[0].NamespacedResource)
	assert.True(t, queued[0].reconcile)
}

// Each index is compared once per interval, at its own slot.
func TestReconcileComesDueAtTheIndexSlot(t *testing.T) {
	server, idx := repairServer(t, &reconcileStorage{}, nil)
	slot := lastReconcileSlot(GlobalSearchKey("ns"), time.Now())

	idx.reconciledAt = slot.Add(time.Second)
	server.queueDueReconciles([]NamespacedResource{GlobalSearchKey("ns")}, slot.Add(globalIndexReconcileInterval-time.Second))
	assert.Zero(t, server.rebuildQueue.Len(), "compared since its slot, and the next is not here yet")

	server.queueDueReconciles([]NamespacedResource{GlobalSearchKey("ns")}, slot.Add(globalIndexReconcileInterval+time.Second))
	assert.Equal(t, 1, server.rebuildQueue.Len(), "its next slot has passed")
}

// Slots repeat every interval, at an offset taken from the key.
func TestReconcileSlotsRepeatEveryInterval(t *testing.T) {
	now := time.Now()
	slot := lastReconcileSlot(GlobalSearchKey("ns"), now)
	assert.False(t, slot.After(now))
	assert.Less(t, now.Sub(slot), globalIndexReconcileInterval)
	assert.Equal(t, slot.Add(globalIndexReconcileInterval), lastReconcileSlot(GlobalSearchKey("ns"), now.Add(globalIndexReconcileInterval)))
}

// A build lists everything, so it counts as a comparison with storage.
func TestGlobalIndexBuildRecordsReconciledAt(t *testing.T) {
	storage := &multiTypeStorage{live: map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}}}
	server := globalTestServer(t, storage, &mockSearchBackend{})
	before := time.Now()

	idx, err := server.build(t.Context(), GlobalSearchKey("ns"), 1, "test", false, time.Time{})
	require.NoError(t, err)

	reconciledAt, err := idx.ReconciledAt()
	require.NoError(t, err)
	assert.False(t, reconciledAt.Before(before))
}

// A reconcile that failed for a type is not recorded, so the next scan tries
// again rather than waiting another interval.
func TestFailedReconcileIsNotRecorded(t *testing.T) {
	server, idx := repairServer(t, &reconcileStorage{}, nil)
	idx.documentRefsErr = errors.New("index unavailable")

	_, err := server.reconcileGlobalIndex(t.Context(), GlobalSearchKey("ns"))
	require.Error(t, err)
	assert.Zero(t, idx.reconciledAt)
}

// Every reconcile is timed under its result, and reports what it repaired.
func TestReconcileIsTimedByResult(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-new", "dash-broken"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 50},
	}}
	storage.broken = map[string]bool{"dash-broken": true}
	server, idx := repairServer(t, storage, map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: {{Name: "dash-gone", RV: 40}},
	})

	res, err := server.reconcileGlobalIndex(t.Context(), GlobalSearchKey("ns"))
	require.NoError(t, err)
	assert.Equal(t, repairResult{Reindexed: 1, Removed: 1, Failed: 1}, res)

	idx.documentRefsErr = errors.New("index unavailable")
	_, err = server.reconcileGlobalIndex(t.Context(), GlobalSearchKey("ns"))
	require.Error(t, err)

	observed := func(result string) uint64 {
		m := &dto.Metric{}
		require.NoError(t, server.indexMetrics.GlobalReconcileDuration.WithLabelValues(result).(prometheus.Histogram).Write(m))
		return m.GetHistogram().GetSampleCount()
	}
	assert.Equal(t, uint64(1), observed("success"))
	assert.Equal(t, uint64(1), observed("failure"))
}

// The index is looked up for each batch, so once a rebuild or a reopen has
// replaced it, notifications go to the replacement, not the old one.
func TestWatchWritesToAReplacedIndex(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live: map[NamespacedResource][]string{dashboardType("ns"): {"dash-a", "dash-b"}},
	}}
	server, old := repairServer(t, storage, nil)

	server.applyWrittenKeys(t.Context(), []*resourcepb.ResourceKey{
		writtenKey(dashboardType("ns"), "dash-a"),
	})
	replacement := &MockResourceIndex{}
	server.search.(*mockSearchBackend).cache[GlobalSearchKey("ns")] = replacement
	server.applyWrittenKeys(t.Context(), []*resourcepb.ResourceKey{
		writtenKey(dashboardType("ns"), "dash-b"),
	})

	assert.Equal(t, map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}}, indexedNames(t, old))
	assert.Equal(t, map[NamespacedResource][]string{dashboardType("ns"): {"dash-b"}}, indexedNames(t, replacement))
}

// An import can restore an object at an older version than the index holds. A
// written key still makes the index hold what storage holds.
func TestWatchWritesWhatAnImportRestored(t *testing.T) {
	storage := &reconcileStorage{multiTypeStorage: multiTypeStorage{
		live:    map[NamespacedResource][]string{dashboardType("ns"): {"dash-a"}},
		listRVs: map[NamespacedResource]int64{dashboardType("ns"): 30},
	}}
	storage.titles = map[string]string{"dash-a": "From the backup"}
	server, idx := repairServer(t, storage, map[schema.GroupResource][]DocumentRef{
		dashboardsGroupResource: {{Name: "dash-a", RV: 50}},
	})
	server.applyWrittenKeys(t.Context(), []*resourcepb.ResourceKey{writtenKey(dashboardType("ns"), "dash-a")})

	items := idx.indexedItems()
	require.Len(t, items, 1)
	assert.Equal(t, "From the backup", items[0].Doc.Title)
}
