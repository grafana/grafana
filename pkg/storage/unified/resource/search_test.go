package resource

import (
	"context"
	"errors"
	"fmt"
	"iter"
	"sync"
	"testing"
	"time"

	"github.com/grafana/authlib/types"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var _ ResourceIndex = &MockResourceIndex{}

// Mock implementations
type MockResourceIndex struct {
	mock.Mock

	updateIndexError error

	updateIndexMu    sync.Mutex
	updateIndexCalls []string
}

func (m *MockResourceIndex) BulkIndex(req *BulkIndexRequest) error {
	args := m.Called(req)
	return args.Error(0)
}

func (m *MockResourceIndex) Search(ctx context.Context, access types.AccessClient, req *resourcepb.ResourceSearchRequest, federate []ResourceIndex) (*resourcepb.ResourceSearchResponse, error) {
	args := m.Called(ctx, access, req, federate)
	return args.Get(0).(*resourcepb.ResourceSearchResponse), args.Error(1)
}

func (m *MockResourceIndex) CountManagedObjects(ctx context.Context) ([]*resourcepb.CountManagedObjectsResponse_ResourceCount, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*resourcepb.CountManagedObjectsResponse_ResourceCount), args.Error(1)
}

func (m *MockResourceIndex) DocCount(ctx context.Context, folder string) (int64, error) {
	args := m.Called(ctx, folder)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockResourceIndex) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	args := m.Called(ctx, req)
	return args.Get(0).(*resourcepb.ListManagedObjectsResponse), args.Error(1)
}

func (m *MockResourceIndex) UpdateIndex(ctx context.Context, reason string) (int64, error) {
	m.updateIndexMu.Lock()
	defer m.updateIndexMu.Unlock()

	m.updateIndexCalls = append(m.updateIndexCalls, reason)
	return 0, m.updateIndexError
}

var _ DocumentBuilder = &MockDocumentBuilder{}

type MockDocumentBuilder struct {
	mock.Mock
}

func (m *MockDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, resourceVersion int64, value []byte) (*IndexableDocument, error) {
	args := m.Called(ctx, key, resourceVersion, value)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*IndexableDocument), nil
}

// mockStorageBackend implements StorageBackend for testing
type mockStorageBackend struct {
	resourceStats []ResourceStats
}

func (m *mockStorageBackend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]ResourceStats, error) {
	var result []ResourceStats
	for _, stat := range m.resourceStats {
		// Apply the minCount filter like the real implementation does
		if stat.Count > int64(minCount) {
			result = append(result, stat)
		}
	}
	return result, nil
}

func (m *mockStorageBackend) WriteEvent(ctx context.Context, event WriteEvent) (int64, error) {
	return 0, nil
}

func (m *mockStorageBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	return nil
}

func (m *mockStorageBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	return nil, nil
}

func (m *mockStorageBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, callback func(ListIterator) error) (int64, error) {
	return 0, nil
}

func (m *mockStorageBackend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, callback func(ListIterator) error) (int64, error) {
	return 0, nil
}

func (m *mockStorageBackend) ListModifiedSince(ctx context.Context, key NamespacedResource, sinceRv int64) (int64, iter.Seq2[*ModifiedResource, error]) {
	return 0, func(yield func(*ModifiedResource, error) bool) {
		yield(nil, errors.New("not implemented"))
	}
}

// mockSearchBackend implements SearchBackend for testing with tracking capabilities
type mockSearchBackend struct {
	mu                   sync.Mutex
	buildIndexCalls      []buildIndexCall
	buildEmptyIndexCalls []buildEmptyIndexCall
	cache                map[NamespacedResource]ResourceIndex
}

type buildIndexCall struct {
	key    NamespacedResource
	size   int64
	fields SearchableDocumentFields
}

type buildEmptyIndexCall struct {
	key             NamespacedResource
	size            int64 // should be 0 for empty indexes
	resourceVersion int64
	fields          SearchableDocumentFields
}

func (m *mockSearchBackend) GetIndex(ctx context.Context, key NamespacedResource) (ResourceIndex, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.cache[key], nil
}

func (m *mockSearchBackend) BuildIndex(ctx context.Context, key NamespacedResource, size int64, fields SearchableDocumentFields, reason string, builder BuildFn, updater UpdateFn, rebuild bool) (ResourceIndex, error) {
	index := &MockResourceIndex{}
	index.On("BulkIndex", mock.Anything).Return(nil).Maybe()
	index.On("DocCount", mock.Anything, mock.Anything).Return(int64(0), nil).Maybe()

	// Call the builder function (required by the contract)
	_, err := builder(index)
	if err != nil {
		return nil, err
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.cache == nil {
		m.cache = make(map[NamespacedResource]ResourceIndex)
	}
	m.cache[key] = index

	// Determine if this is an empty index based on size
	// Empty indexes are characterized by size == 0
	if size == 0 {
		// This is an empty index (buildEmptyIndex was called)
		m.buildEmptyIndexCalls = append(m.buildEmptyIndexCalls, buildEmptyIndexCall{
			key:    key,
			size:   size,
			fields: fields,
		})
	} else {
		// This is a normal index (build was called)
		m.buildIndexCalls = append(m.buildIndexCalls, buildIndexCall{
			key:    key,
			size:   size,
			fields: fields,
		})
	}

	return index, nil
}

func (m *mockSearchBackend) TotalDocs() int64 {
	return 0
}

func TestSearchGetOrCreateIndex(t *testing.T) {
	// Setup mock implementations
	storage := &mockStorageBackend{
		resourceStats: []ResourceStats{
			{NamespacedResource: NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, Count: 50, ResourceVersion: 11111111},
		},
	}
	search := &mockSearchBackend{
		buildIndexCalls:      []buildIndexCall{},
		buildEmptyIndexCalls: []buildEmptyIndexCall{},
	}
	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{
			"group": "resource",
		},
	}

	// Create search support with the specified initMaxSize
	opts := SearchOptions{
		Backend:       search,
		Resources:     supplier,
		WorkerThreads: 1,
		InitMinCount:  1, // set min count to default for this test
	}

	support, err := newSearchSupport(opts, storage, nil, nil, noop.NewTracerProvider().Tracer("test"), nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	start := make(chan struct{})

	const concurrency = 100
	wg := sync.WaitGroup{}
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			_, _ = support.getOrCreateIndex(context.Background(), NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, "test")
		}()
	}

	// Wait a bit for goroutines to start (hopefully)
	time.Sleep(10 * time.Millisecond)
	// Unblock all goroutines.
	close(start)
	wg.Wait()

	require.NotEmpty(t, search.buildIndexCalls)
	require.Less(t, len(search.buildIndexCalls), concurrency, "Should not have built index more than a few times (ideally once)")
	require.Equal(t, int64(50), search.buildIndexCalls[0].size)
}

func TestSearchGetOrCreateIndexWithIndexUpdate(t *testing.T) {
	// Setup mock implementations
	storage := &mockStorageBackend{
		resourceStats: []ResourceStats{
			{NamespacedResource: NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, Count: 50, ResourceVersion: 11111111},
		},
	}
	failedErr := fmt.Errorf("failed to update index")
	search := &mockSearchBackend{
		buildIndexCalls:      []buildIndexCall{},
		buildEmptyIndexCalls: []buildEmptyIndexCall{},

		cache: map[NamespacedResource]ResourceIndex{
			{Namespace: "ns", Group: "group", Resource: "bad"}: &MockResourceIndex{
				updateIndexError: failedErr,
			},
		},
	}
	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{
			"group": "resource",
		},
	}

	// Create search support with the specified initMaxSize
	opts := SearchOptions{
		Backend:       search,
		Resources:     supplier,
		WorkerThreads: 1,
		InitMinCount:  1, // set min count to default for this test
	}

	// Enable searchAfterWrite
	support, err := newSearchSupport(opts, storage, nil, nil, noop.NewTracerProvider().Tracer("test"), nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	idx, err := support.getOrCreateIndex(context.Background(), NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, "initial call")
	require.NoError(t, err)
	require.NotNil(t, idx)
	checkMockIndexUpdateCalls(t, idx, []string{"initial call"})

	idx, err = support.getOrCreateIndex(context.Background(), NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, "second call")
	require.NoError(t, err)
	require.NotNil(t, idx)
	checkMockIndexUpdateCalls(t, idx, []string{"initial call", "second call"})

	idx, err = support.getOrCreateIndex(context.Background(), NamespacedResource{Namespace: "ns", Group: "group", Resource: "bad"}, "call to bad index")
	require.ErrorIs(t, err, failedErr)
	require.Nil(t, idx)
}

func checkMockIndexUpdateCalls(t *testing.T, idx ResourceIndex, strings []string) {
	mi, ok := idx.(*MockResourceIndex)
	require.True(t, ok)
	mi.updateIndexMu.Lock()
	defer mi.updateIndexMu.Unlock()
	require.Equal(t, strings, mi.updateIndexCalls)
}

func TestSearchGetOrCreateIndexWithCancellation(t *testing.T) {
	// Setup mock implementations
	storage := &mockStorageBackend{
		resourceStats: []ResourceStats{
			{NamespacedResource: NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}, Count: 50, ResourceVersion: 11111111},
		},
	}
	search := &slowSearchBackendWithCache{
		mockSearchBackend: mockSearchBackend{},
	}
	supplier := &TestDocumentBuilderSupplier{
		GroupsResources: map[string]string{
			"group": "resource",
		},
	}

	// Create search support with the specified initMaxSize
	opts := SearchOptions{
		Backend:       search,
		Resources:     supplier,
		WorkerThreads: 1,
		InitMinCount:  1, // set min count to default for this test
	}

	support, err := newSearchSupport(opts, storage, nil, nil, noop.NewTracerProvider().Tracer("test"), nil, nil, nil)
	require.NoError(t, err)
	require.NotNil(t, support)

	key := NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"}

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Millisecond)
	defer cancel()

	_, err = support.getOrCreateIndex(ctx, key, "test")
	// Make sure we get context deadline error
	require.ErrorIs(t, err, context.DeadlineExceeded)

	// Wait until indexing is finished.
	search.wg.Wait()

	require.NotEmpty(t, search.buildIndexCalls)

	// Wait until new index is put into cache.
	require.Eventually(t, func() bool {
		idx, err := support.search.GetIndex(ctx, key)
		return err == nil && idx != nil
	}, 1*time.Second, 100*time.Millisecond, "Indexing finishes despite context cancellation")

	// Second call to getOrCreateIndex returns index immediately, even if context is canceled, as the index is now ready and cached.
	_, err = support.getOrCreateIndex(ctx, key, "test")
	require.NoError(t, err)
}

type slowSearchBackendWithCache struct {
	mockSearchBackend
	wg sync.WaitGroup
}

func (m *slowSearchBackendWithCache) GetIndex(ctx context.Context, key NamespacedResource) (ResourceIndex, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.cache[key], nil
}

func (m *slowSearchBackendWithCache) BuildIndex(ctx context.Context, key NamespacedResource, size int64, fields SearchableDocumentFields, reason string, builder BuildFn, updater UpdateFn, rebuild bool) (ResourceIndex, error) {
	m.wg.Add(1)
	defer m.wg.Done()

	time.Sleep(1 * time.Second)

	// Simulate erroring out when context is cancelled.
	if ctx.Err() != nil {
		return nil, ctx.Err()
	}
	idx, err := m.mockSearchBackend.BuildIndex(ctx, key, size, fields, reason, builder, updater, rebuild)
	if err != nil {
		return nil, err
	}
	return idx, nil
}
