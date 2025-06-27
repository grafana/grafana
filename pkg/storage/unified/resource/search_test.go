package resource

import (
	"context"
	"testing"

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

// simpleResourceIndex implements ResourceIndex for testing
type simpleResourceIndex struct {
	bulkIndexCalls []BulkIndexRequest
}

func (s *simpleResourceIndex) BulkIndex(req *BulkIndexRequest) error {
	s.bulkIndexCalls = append(s.bulkIndexCalls, *req)
	return nil
}

func (s *simpleResourceIndex) Search(ctx context.Context, access types.AccessClient, req *resourcepb.ResourceSearchRequest, federate []ResourceIndex) (*resourcepb.ResourceSearchResponse, error) {
	return &resourcepb.ResourceSearchResponse{}, nil
}

func (s *simpleResourceIndex) CountManagedObjects(ctx context.Context) ([]*resourcepb.CountManagedObjectsResponse_ResourceCount, error) {
	return nil, nil
}

func (s *simpleResourceIndex) DocCount(ctx context.Context, folder string) (int64, error) {
	return 0, nil
}

func (s *simpleResourceIndex) ListManagedObjects(ctx context.Context, req *resourcepb.ListManagedObjectsRequest) (*resourcepb.ListManagedObjectsResponse, error) {
	return &resourcepb.ListManagedObjectsResponse{}, nil
}

// simpleDocumentBuilder implements DocumentBuilder for testing
type simpleDocumentBuilder struct{}

func (s *simpleDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, resourceVersion int64, value []byte) (*IndexableDocument, error) {
	return &IndexableDocument{Key: key}, nil
}

// simpleStorageBackend implements StorageBackend for testing
type simpleStorageBackend struct {
	resourceStats []ResourceStats
}

func (s *simpleStorageBackend) GetResourceStats(ctx context.Context, namespace string, minCount int) ([]ResourceStats, error) {
	var result []ResourceStats
	for _, stat := range s.resourceStats {
		// Apply the minCount filter like the real implementation does
		if stat.Count > int64(minCount) {
			result = append(result, stat)
		}
	}
	return result, nil
}

func (s *simpleStorageBackend) WriteEvent(ctx context.Context, event WriteEvent) (int64, error) {
	return 0, nil
}

func (s *simpleStorageBackend) ReadResource(ctx context.Context, req *resourcepb.ReadRequest) *BackendReadResponse {
	return nil
}

func (s *simpleStorageBackend) WatchWriteEvents(ctx context.Context) (<-chan *WrittenEvent, error) {
	return nil, nil
}

func (s *simpleStorageBackend) ListIterator(ctx context.Context, req *resourcepb.ListRequest, callback func(ListIterator) error) (int64, error) {
	return 0, nil
}

func (s *simpleStorageBackend) ListHistory(ctx context.Context, req *resourcepb.ListRequest, callback func(ListIterator) error) (int64, error) {
	return 0, nil
}

// simpleSearchBackend implements SearchBackend for testing with tracking capabilities
type simpleSearchBackend struct {
	buildIndexCalls      []buildIndexCall
	buildEmptyIndexCalls []buildEmptyIndexCall
	indexes              map[string]ResourceIndex
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

func (s *simpleSearchBackend) GetIndex(ctx context.Context, key NamespacedResource) (ResourceIndex, error) {
	return s.indexes[key.String()], nil
}

func (s *simpleSearchBackend) BuildIndex(ctx context.Context, key NamespacedResource, size int64, resourceVersion int64, fields SearchableDocumentFields, builder func(index ResourceIndex) (int64, error)) (ResourceIndex, error) {
	// Create a simple index
	index := &simpleResourceIndex{
		bulkIndexCalls: []BulkIndexRequest{},
	}

	// Call the builder function (required by the contract)
	_, err := builder(index)
	if err != nil {
		return nil, err
	}

	// Determine if this is an empty index based on size
	// Empty indexes are characterized by size == 0
	if size == 0 {
		// This is an empty index (buildEmptyIndex was called)
		s.buildEmptyIndexCalls = append(s.buildEmptyIndexCalls, buildEmptyIndexCall{
			key:             key,
			size:            size,
			resourceVersion: resourceVersion,
			fields:          fields,
		})
	} else {
		// This is a normal index (build was called)
		s.buildIndexCalls = append(s.buildIndexCalls, buildIndexCall{
			key:             key,
			size:            size,
			resourceVersion: resourceVersion,
			fields:          fields,
		})
	}

	s.indexes[key.String()] = index
	return index, nil
}

func (s *simpleSearchBackend) TotalDocs() int64 {
	return 0
}

// simpleDocumentBuilderSupplier for testing
type simpleDocumentBuilderSupplier struct{}

func (s *simpleDocumentBuilderSupplier) GetDocumentBuilders() ([]DocumentBuilderInfo, error) {
	return []DocumentBuilderInfo{
		{
			Builder: &simpleDocumentBuilder{},
		},
	}, nil
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
			// Setup simple implementations
			storage := &simpleStorageBackend{
				resourceStats: tt.resourceStats,
			}
			search := &simpleSearchBackend{
				buildIndexCalls:      []buildIndexCall{},
				buildEmptyIndexCalls: []buildEmptyIndexCall{},
				indexes:              make(map[string]ResourceIndex),
			}
			supplier := &simpleDocumentBuilderSupplier{}

			// Create search support with the specified initMaxSize
			opts := SearchOptions{
				Backend:       search,
				Resources:     supplier,
				WorkerThreads: 1,
				InitMinCount:  0, // disable min count for this test
				InitMaxCount:  tt.initMaxSize,
			}

			support, err := newSearchSupport(opts, storage, nil, nil, noop.NewTracerProvider().Tracer("test"), nil)
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
