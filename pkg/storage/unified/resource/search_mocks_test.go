package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"maps"
	"slices"
	"sync"
	"sync/atomic"
	"time"

	"github.com/grafana/authlib/types"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Mock implementations
type MockResourceIndex struct {
	updateIndexError error

	updateIndexMu    sync.Mutex
	updateIndexCalls int

	buildInfo IndexBuildInfo
	docCount  int64

	// Types recorded through RecordCompletedTypeBuild, and an error to fail
	// reading them with.
	completedTypeBuilds    map[schema.GroupResource]TypeBuild
	completedTypeBuildsErr error

	// What the index reports holding, for reconciliation tests.
	documentRefs    map[schema.GroupResource][]DocumentRef
	documentRefsErr error

	// Types recorded as written, as the real index records them in BulkIndex
	// and forgets them in ForgetType.
	documentTypes map[schema.GroupResource]struct{}

	// When the index was last compared with storage, through RecordReconciledAt.
	reconciledAt time.Time

	// Items passed to BulkIndex, and how many writes carried them, guarded by
	// updateIndexMu.
	bulkItems []*BulkIndexItem
	bulkCalls int
	// Fails BulkIndex from this call on, counting from 1, when not zero.
	failBulkFromCall int

	// Optional configured results for the managed-object RPCs. When nil the
	// methods return an error, matching the default "not expected" behaviour.
	managedObjects *resourcepb.ListManagedObjectsResponse
	managedCounts  []*resourcepb.CountManagedObjectsResponse_ResourceCount
}

func (m *MockResourceIndex) BuildInfo() (IndexBuildInfo, error) {
	bi := m.buildInfo
	// The mock stands for an index this binary built, so it maps the current
	// features unless a test sets them. A test that wants an older index sets them
	// to an empty (non-nil) slice.
	if bi.Features == nil {
		bi.Features = CurrentIndexFeatures()
	}
	return bi, nil
}

func (m *MockResourceIndex) BulkIndex(req *BulkIndexRequest) error {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	m.bulkCalls++
	if m.failBulkFromCall > 0 && m.bulkCalls >= m.failBulkFromCall {
		return fmt.Errorf("bulk index failed")
	}
	m.bulkItems = append(m.bulkItems, req.Items...)
	for _, item := range req.Items {
		if item.Action == ActionIndex && item.Doc != nil && item.Doc.Key != nil {
			if m.documentTypes == nil {
				m.documentTypes = map[schema.GroupResource]struct{}{}
			}
			m.documentTypes[schema.GroupResource{Group: item.Doc.Key.Group, Resource: item.Doc.Key.Resource}] = struct{}{}
		}
	}
	return nil
}

// indexedItems returns the items passed to BulkIndex so far.
func (m *MockResourceIndex) indexedItems() []*BulkIndexItem {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	return slices.Clone(m.bulkItems)
}

func (m *MockResourceIndex) Search(_ context.Context, _ types.AccessClient, _ *resourcepb.ResourceSearchRequest, _ []ResourceIndex, _ *SearchStats) (*resourcepb.ResourceSearchResponse, error) {
	return nil, fmt.Errorf("not expected")
}

func (m *MockResourceIndex) CountManagedObjects(_ context.Context, _ *SearchStats) ([]*resourcepb.CountManagedObjectsResponse_ResourceCount, error) {
	if m.managedCounts != nil {
		return m.managedCounts, nil
	}
	return nil, fmt.Errorf("not expected")
}

func (m *MockResourceIndex) DocCount(_ context.Context, _ string, _ *SearchStats) (int64, error) {
	return m.docCount, nil
}

func (m *MockResourceIndex) CompletedTypeBuilds() (map[schema.GroupResource]TypeBuild, error) {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	if m.completedTypeBuildsErr != nil {
		return nil, m.completedTypeBuildsErr
	}
	return maps.Clone(m.completedTypeBuilds), nil
}

func (m *MockResourceIndex) RecordCompletedTypeBuild(gr schema.GroupResource, build TypeBuild) error {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	if m.completedTypeBuilds == nil {
		m.completedTypeBuilds = map[schema.GroupResource]TypeBuild{}
	}
	m.completedTypeBuilds[gr] = build
	return nil
}

// DocumentTypes answers with the types recorded as written, and the types a
// test set up documentRefs for, which stand for documents written before it.
func (m *MockResourceIndex) DocumentTypes() ([]schema.GroupResource, error) {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	types := maps.Clone(m.documentTypes)
	if types == nil {
		types = map[schema.GroupResource]struct{}{}
	}
	for gr, refs := range m.documentRefs {
		if len(refs) > 0 {
			types[gr] = struct{}{}
		}
	}
	return slices.Collect(maps.Keys(types)), nil
}

func (m *MockResourceIndex) ReconciledAt() (time.Time, error) {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	return m.reconciledAt, nil
}

func (m *MockResourceIndex) RecordReconciledAt(t time.Time) error {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	m.reconciledAt = t
	return nil
}

// ForgetType forgets both records, and the documents a test set up, which the
// caller has removed by now.
func (m *MockResourceIndex) ForgetType(gr schema.GroupResource) error {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()
	delete(m.completedTypeBuilds, gr)
	delete(m.documentTypes, gr)
	delete(m.documentRefs, gr)
	return nil
}

// documentRefs is what ListDocumentRefs answers with, by resource type.
func (m *MockResourceIndex) ListDocumentRefs(_ context.Context, gr schema.GroupResource) iter.Seq2[DocumentRef, error] {
	return func(yield func(DocumentRef, error) bool) {
		m.updateIndexMu.Lock()
		refs := slices.Clone(m.documentRefs[gr])
		err := m.documentRefsErr
		m.updateIndexMu.Unlock()

		if err != nil {
			yield(DocumentRef{}, err)
			return
		}
		for _, ref := range refs {
			if !yield(ref, nil) {
				return
			}
		}
	}
}

func (m *MockResourceIndex) ListManagedObjects(_ context.Context, _ *resourcepb.ListManagedObjectsRequest, _ *SearchStats) (*resourcepb.ListManagedObjectsResponse, error) {
	if m.managedObjects != nil {
		return m.managedObjects, nil
	}
	return nil, fmt.Errorf("not expected")
}

func (m *MockResourceIndex) UpdateIndex(_ context.Context) (int64, error) {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()

	m.updateIndexCalls++
	return 0, m.updateIndexError
}

// mockStorageBackend implements StorageBackend for testing
type mockStorageBackend struct {
	UnimplementedStorageBackend
	resourceStats       []ResourceStats
	lastImportTimes     []ResourceLastImportTime
	statsCalls          atomic.Int32
	listStoredCalls     atomic.Int32
	listStoredErr       error
	lastCountLimit      atomic.Int64
	lastImportTimeCalls atomic.Int32
}

func (m *mockStorageBackend) GetResourceStats(ctx context.Context, nsr NamespacedResource, minCount int) ([]ResourceStats, error) {
	m.statsCalls.Add(1)
	var result []ResourceStats
	for _, stat := range m.resourceStats {
		// Apply the minCount filter like the real implementation does
		if stat.Count > int64(minCount) {
			result = append(result, stat)
		}
	}
	return result, nil
}

// ListStoredResources reports the distinct group/resource identities in the
// namespace, derived from the configured resourceStats. It is the discovery
// primitive the search server uses instead of counting via GetResourceStats.
func (m *mockStorageBackend) ListStoredResources(_ context.Context, filter NamespacedResource) ([]NamespacedResource, error) {
	m.listStoredCalls.Add(1)
	if m.listStoredErr != nil {
		return nil, m.listStoredErr
	}
	if filter.Namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}
	var result []NamespacedResource
	for _, stat := range m.resourceStats {
		if stat.Namespace != filter.Namespace {
			continue
		}
		if filter.Group != "" && stat.Group != filter.Group {
			continue
		}
		if filter.Resource != "" && stat.Resource != filter.Resource {
			continue
		}
		result = append(result, stat.NamespacedResource)
	}
	return result, nil
}

func (m *mockStorageBackend) GetResourceStatsWithLimit(ctx context.Context, nsr NamespacedResource, minCount, countLimit int) ([]ResourceStats, error) {
	m.lastCountLimit.Store(int64(countLimit))
	return m.GetResourceStats(ctx, nsr, minCount)
}

func (m *mockStorageBackend) WriteEvent(ctx context.Context, event WriteEvent) (int64, error) {
	return 0, nil
}

func (m *mockStorageBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	return nil
}

func (m *mockStorageBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	ch := make(chan *WrittenEvent)
	context.AfterFunc(ctx, func() { close(ch) })
	return ch, nil
}

func (m *mockStorageBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, callback func(ListIterator) error) (int64, error) {
	return 0, nil
}

func (m *mockStorageBackend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, callback func(ListIterator) error) (int64, error) {
	return 0, nil
}

func (m *mockStorageBackend) ListModifiedSince(ctx context.Context, key NamespacedResource, sinceRv int64, _ *time.Time) (int64, iter.Seq2[*ModifiedResource, error]) {
	return 0, func(yield func(*ModifiedResource, error) bool) {
		yield(nil, errors.New("not implemented"))
	}
}

func (m *mockStorageBackend) GetResourceLastImportTime(ctx context.Context, nsr NamespacedResource) (time.Time, error) {
	m.lastImportTimeCalls.Add(1)
	for _, importTime := range m.lastImportTimes {
		if importTime.NamespacedResource == nsr {
			return importTime.LastImportTime, nil
		}
	}
	return time.Time{}, nil
}

func (m *mockStorageBackend) ListResourceLastImportTimes(context.Context) (map[NamespacedResource]time.Time, error) {
	result := make(map[NamespacedResource]time.Time)
	for _, entry := range m.lastImportTimes {
		result[entry.NamespacedResource] = entry.LastImportTime
	}
	return result, nil
}

// featuresForTestIndex describes an index that does or does not keep deleted
// documents. Only a new index keeps them, so the false case stands in for an index
// built before that was the case.
func featuresForTestIndex(keepsDeletedDocuments bool) []IndexFeature {
	features := CurrentIndexFeatures()
	if keepsDeletedDocuments {
		return features
	}
	return slices.DeleteFunc(features, func(f IndexFeature) bool {
		return f == IndexFeatureHoldsDeletedDocuments
	})
}

// mockSearchBackend implements SearchBackend for testing with tracking capabilities
type mockSearchBackend struct {
	openIndexes []NamespacedResource
	// What the previous run left recorded as open, returned by LoadOpenIndexStats.
	openIndexStats []ResourceStats

	// Recorded on every index this backend builds, standing in for the decision the
	// real backend makes from its options at creation.
	keepsDeletedDocuments bool

	// Skips the build function, as for an index reused from disk.
	reusesFromDisk bool

	mu                sync.Mutex
	buildIndexCalls   []buildIndexCall
	cache             map[NamespacedResource]ResourceIndex
	stopCalls         atomic.Int32
	snapshotThreshold int64
	// Updater from the most recent BuildIndex, so a test can drive it.
	lastUpdater UpdateFn
}

func (m *mockSearchBackend) SnapshotCountThreshold() int64 {
	return m.snapshotThreshold
}

func (m *mockSearchBackend) RemoveExpiredTrash(context.Context) {}

type buildIndexCall struct {
	key  NamespacedResource
	size int64
}

func (m *mockSearchBackend) LoadOpenIndexStats(_ time.Time, _ time.Duration) ([]ResourceStats, error) {
	return m.openIndexStats, nil
}

func (m *mockSearchBackend) WriteOpenIndexStats(_ time.Time) error {
	return nil
}

func (m *mockSearchBackend) GetIndex(key NamespacedResource) ResourceIndex {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.cache[key]
}

func (m *mockSearchBackend) BuildIndex(ctx context.Context, key NamespacedResource, size int64, reason string, builder BuildFn, updater UpdateFn, rebuild bool, lastImportTime time.Time, _ time.Duration) (ResourceIndex, error) {
	index := &MockResourceIndex{buildInfo: IndexBuildInfo{Features: featuresForTestIndex(m.keepsDeletedDocuments)}}
	m.mu.Lock()
	m.lastUpdater = updater
	m.mu.Unlock()

	// Call the builder function (required by the contract), unless standing in
	// for an index reused from disk, which is not built again.
	if !m.reusesFromDisk {
		_, err := builder(index)
		if err != nil {
			return nil, err
		}
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cache == nil {
		m.cache = make(map[NamespacedResource]ResourceIndex)
	}
	m.cache[key] = index

	// Determine if this is an empty index based on size
	// Empty indexes are characterized by size == 0
	m.buildIndexCalls = append(m.buildIndexCalls, buildIndexCall{
		key:  key,
		size: size,
	})

	return index, nil
}

func (m *mockSearchBackend) TotalDocs() int64 {
	return 0
}

func (m *mockSearchBackend) GetOpenIndexes() []NamespacedResource {
	return m.openIndexes
}

func (m *mockSearchBackend) Stop() {
	m.stopCalls.Add(1)
}
