package resource

import (
	"context"
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

// mockSearchBackend implements SearchBackend for testing with tracking capabilities
type mockSearchBackend struct {
	mu                   sync.Mutex
	buildIndexCalls      []buildIndexCall
	buildEmptyIndexCalls []buildEmptyIndexCall
}

type buildIndexCall struct {
	key             NamespacedResource
	size            int64
	resourceVersion int64
	fields          SearchableDocumentFields
}

type buildEmptyIndexCall struct {
	key             NamespacedResource
	size            int64 // should be 0 for empty indexes
	resourceVersion int64
	fields          SearchableDocumentFields
}

func (m *mockSearchBackend) GetIndex(ctx context.Context, key NamespacedResource) (ResourceIndex, error) {
	return nil, nil
}

func (m *mockSearchBackend) BuildIndex(ctx context.Context, key NamespacedResource, size int64, resourceVersion int64, fields SearchableDocumentFields, builder func(index ResourceIndex) (int64, error)) (ResourceIndex, error) {
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

	// Determine if this is an empty index based on size
	// Empty indexes are characterized by size == 0
	if size == 0 {
		// This is an empty index (buildEmptyIndex was called)
		m.buildEmptyIndexCalls = append(m.buildEmptyIndexCalls, buildEmptyIndexCall{
			key:             key,
			size:            size,
			resourceVersion: resourceVersion,
			fields:          fields,
		})
	} else {
		// This is a normal index (build was called)
		m.buildIndexCalls = append(m.buildIndexCalls, buildIndexCall{
			key:             key,
			size:            size,
			resourceVersion: resourceVersion,
			fields:          fields,
		})
	}

	return index, nil
}

func (m *mockSearchBackend) TotalDocs() int64 {
	return 0
}

func TestBuildIndexes_MaxCountThreshold(t *testing.T) {
	tests := []struct {
		name                 string
		initMaxSize          int
		resourceStats        []ResourceStats
		expectedNormalBuilds []string // expected NamespacedResource strings that should be built normally
		expectedEmptyBuilds  []string // expected NamespacedResource strings that should be built as empty
	}{
		{
			name:        "max count disabled (0) - all resources built normally",
			initMaxSize: 0,
			resourceStats: []ResourceStats{
				{NamespacedResource: NamespacedResource{Namespace: "ns1", Group: "group1", Resource: "resource1"}, Count: 50},
				{NamespacedResource: NamespacedResource{Namespace: "ns1", Group: "group1", Resource: "resource2"}, Count: 150},
				{NamespacedResource: NamespacedResource{Namespace: "ns1", Group: "group2", Resource: "resource1"}, Count: 250},
			},
			expectedNormalBuilds: []string{
				"ns1/group1/resource1",
				"ns1/group1/resource2",
				"ns1/group2/resource1",
			},
			expectedEmptyBuilds: []string{},
		},
		{
			name:        "max count 100 - resources above threshold get empty indexes",
			initMaxSize: 100,
			resourceStats: []ResourceStats{
				{NamespacedResource: NamespacedResource{Namespace: "ns1", Group: "group1", Resource: "resource1"}, Count: 50},  // normal build
				{NamespacedResource: NamespacedResource{Namespace: "ns1", Group: "group1", Resource: "resource2"}, Count: 150}, // empty build
				{NamespacedResource: NamespacedResource{Namespace: "ns1", Group: "group2", Resource: "resource1"}, Count: 250}, // empty build
				{NamespacedResource: NamespacedResource{Namespace: "ns1", Group: "group2", Resource: "resource2"}, Count: 80},  // normal build
			},
			expectedNormalBuilds: []string{
				"ns1/group1/resource1",
				"ns1/group2/resource2",
			},
			expectedEmptyBuilds: []string{
				"ns1/group1/resource2",
				"ns1/group2/resource1",
			},
		},
		{
			name:        "max count 300 - no resources exceed threshold",
			initMaxSize: 300,
			resourceStats: []ResourceStats{
				{NamespacedResource: NamespacedResource{Namespace: "ns1", Group: "group1", Resource: "resource1"}, Count: 50},  // normal build
				{NamespacedResource: NamespacedResource{Namespace: "ns1", Group: "group1", Resource: "resource2"}, Count: 150}, // normal build
				{NamespacedResource: NamespacedResource{Namespace: "ns1", Group: "group2", Resource: "resource1"}, Count: 250}, // normal build
			},
			expectedNormalBuilds: []string{
				"ns1/group1/resource1",
				"ns1/group1/resource2",
				"ns1/group2/resource1",
			},
			expectedEmptyBuilds: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock implementations
			storage := &mockStorageBackend{
				resourceStats: tt.resourceStats,
			}
			search := &mockSearchBackend{
				buildIndexCalls:      []buildIndexCall{},
				buildEmptyIndexCalls: []buildEmptyIndexCall{},
			}
			supplier := &TestDocumentBuilderSupplier{
				GroupsResources: map[string]string{
					"group1": "resource1",
					"group2": "resource2",
				},
			}

			// Create search support with the specified initMaxSize
			opts := SearchOptions{
				Backend:       search,
				Resources:     supplier,
				WorkerThreads: 1,
				InitMinCount:  1, // set min count to default for this test
				InitMaxCount:  tt.initMaxSize,
			}

			support, err := newSearchSupport(opts, storage, nil, nil, noop.NewTracerProvider().Tracer("test"), nil, nil, nil)
			require.NoError(t, err)
			require.NotNil(t, support)

			// Call buildIndexes
			ctx := context.Background()
			indexesBuilt, err := support.buildIndexes(ctx, false)
			require.NoError(t, err)

			// Verify the correct number of indexes were built (normal + empty)
			expectedTotal := len(tt.expectedNormalBuilds) + len(tt.expectedEmptyBuilds)
			require.Equal(t, expectedTotal, indexesBuilt)

			// Verify the correct resources were built normally
			actualNormalBuilds := make([]string, len(search.buildIndexCalls))
			for i, call := range search.buildIndexCalls {
				actualNormalBuilds[i] = call.key.String()
			}
			require.ElementsMatch(t, tt.expectedNormalBuilds, actualNormalBuilds)

			// Verify the correct resources were built as empty indexes
			actualEmptyBuilds := make([]string, len(search.buildEmptyIndexCalls))
			for i, call := range search.buildEmptyIndexCalls {
				actualEmptyBuilds[i] = call.key.String()
				// Verify that empty indexes are built with size 0
				require.Equal(t, int64(0), call.size, "Empty index should be built with size 0")
			}
			require.ElementsMatch(t, tt.expectedEmptyBuilds, actualEmptyBuilds)
		})
	}
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
		InitMaxCount:  0,
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
			_, _ = support.getOrCreateIndex(context.Background(), NamespacedResource{Namespace: "ns", Group: "group", Resource: "resource"})
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
	require.Equal(t, int64(11111111), search.buildIndexCalls[0].resourceVersion)
}
