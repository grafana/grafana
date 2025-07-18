package resource

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// Mock DualWriter
type MockDualWriter struct {
	mock.Mock
}

func (m *MockDualWriter) IsEnabled(gr schema.GroupResource) bool {
	args := m.Called(gr)
	return args.Bool(0)
}

func (m *MockDualWriter) ReadFromUnified(ctx context.Context, gr schema.GroupResource) (bool, error) {
	args := m.Called(ctx, gr)
	return args.Bool(0), args.Error(1)
}

// Mock ResourceIndexClient
type MockResourceIndexClient struct {
	mock.Mock
	searchCalled chan struct{}
	statsCalled  chan struct{}
}

func NewMockResourceIndexClient() *MockResourceIndexClient {
	return &MockResourceIndexClient{
		searchCalled: make(chan struct{}, 1),
		statsCalled:  make(chan struct{}, 1),
	}
}

func (m *MockResourceIndexClient) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	args := m.Called(ctx, in, opts)

	// Signal that Search was called
	select {
	case m.searchCalled <- struct{}{}:
	default:
	}

	return args.Get(0).(*resourcepb.ResourceSearchResponse), args.Error(1)
}

func (m *MockResourceIndexClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	args := m.Called(ctx, in, opts)

	// Signal that GetStats was called
	select {
	case m.statsCalled <- struct{}{}:
	default:
	}

	return args.Get(0).(*resourcepb.ResourceStatsResponse), args.Error(1)
}

func setupTestSearchClient(t *testing.T) (schema.GroupResource, *MockResourceIndexClient, *MockResourceIndexClient, featuremgmt.FeatureToggles) {
	t.Helper()
	gr := schema.GroupResource{Group: "test", Resource: "items"}
	unifiedClient := NewMockResourceIndexClient()
	legacyClient := NewMockResourceIndexClient()
	features := featuremgmt.WithFeatures()
	return gr, unifiedClient, legacyClient, features
}

func setupTestSearchWrapper(t *testing.T, dual *MockDualWriter, unifiedClient, legacyClient *MockResourceIndexClient, features featuremgmt.FeatureToggles, gr schema.GroupResource) *searchWrapper {
	t.Helper()
	return &searchWrapper{
		dual:          dual,
		groupResource: gr,
		unifiedClient: unifiedClient,
		legacyClient:  legacyClient,
		features:      features,
		logger:        log.NewNopLogger(),
	}
}

func TestSearchClient_NewSearchClient(t *testing.T) {
	gr, unifiedClient, legacyClient, features := setupTestSearchClient(t)

	t.Run("returns wrapper when dual writer is enabled", func(t *testing.T) {
		dual := &MockDualWriter{} // Create fresh mock for this test
		dual.On("IsEnabled", gr).Return(true)

		client := NewSearchClient(dual, gr, unifiedClient, legacyClient, features)

		wrapper, ok := client.(*searchWrapper)
		require.True(t, ok)
		assert.Equal(t, dual, wrapper.dual)
		assert.Equal(t, gr, wrapper.groupResource)
		assert.Equal(t, unifiedClient, wrapper.unifiedClient)
		assert.Equal(t, legacyClient, wrapper.legacyClient)

		dual.AssertExpectations(t)
	})

	t.Run("returns unified client when dual writer disabled but read from unified", func(t *testing.T) {
		dual := &MockDualWriter{} // Create fresh mock for this test
		dual.On("IsEnabled", gr).Return(false)
		dual.On("ReadFromUnified", mock.Anything, gr).Return(true, nil)

		client := NewSearchClient(dual, gr, unifiedClient, legacyClient, features)

		assert.Equal(t, unifiedClient, client)
		dual.AssertExpectations(t)
	})

	t.Run("returns legacy client when dual writer disabled and not reading from unified", func(t *testing.T) {
		dual := &MockDualWriter{} // Create fresh mock for this test
		dual.On("IsEnabled", gr).Return(false)
		dual.On("ReadFromUnified", mock.Anything, gr).Return(false, nil)

		client := NewSearchClient(dual, gr, unifiedClient, legacyClient, features)

		assert.Equal(t, legacyClient, client)
		dual.AssertExpectations(t)
	})
}

func TestSearchWrapper_Search(t *testing.T) {
	gr, unifiedClient, legacyClient, features := setupTestSearchClient(t)
	req := &resourcepb.ResourceSearchRequest{Query: "test"}
	expectedResponse := &resourcepb.ResourceSearchResponse{TotalHits: 0}

	t.Run("uses unified client when reading from unified", func(t *testing.T) {
		ctx := testutil.NewDefaultTestContext(t)
		dual := &MockDualWriter{}

		dual.On("ReadFromUnified", mock.Anything, gr).Return(true, nil)
		unifiedClient.On("Search", mock.Anything, req, mock.Anything).Return(expectedResponse, nil)

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, features, gr)

		resp, err := wrapper.Search(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)

		dual.AssertExpectations(t)
		unifiedClient.AssertExpectations(t)
		legacyClient.AssertNotCalled(t, "Search")
	})

	t.Run("uses legacy client when not reading from unified", func(t *testing.T) {
		ctx := testutil.NewDefaultTestContext(t)
		dual := &MockDualWriter{}

		dual.On("ReadFromUnified", mock.Anything, gr).Return(false, nil)
		legacyClient.On("Search", mock.Anything, req, mock.Anything).Return(expectedResponse, nil)

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, features, gr)

		resp, err := wrapper.Search(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)

		dual.AssertExpectations(t)
		legacyClient.AssertExpectations(t)
		unifiedClient.AssertNotCalled(t, "Search")
	})

	t.Run("makes background call to unified when feature flag enabled and using legacy", func(t *testing.T) {
		ctx := testutil.NewDefaultTestContext(t)
		dual := &MockDualWriter{}
		featuresWithFlag := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchDualReaderEnabled)

		dual.On("ReadFromUnified", mock.Anything, gr).Return(false, nil)
		legacyClient.On("Search", mock.Anything, req, mock.Anything).Return(expectedResponse, nil)

		// Expect background call to unified client
		unifiedBgResponse := &resourcepb.ResourceSearchResponse{TotalHits: 0}
		unifiedClient.On("Search", mock.Anything, req, mock.Anything).Return(unifiedBgResponse, nil)

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, featuresWithFlag, gr)

		resp, err := wrapper.Search(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)

		// Wait for background goroutine to complete
		select {
		case <-unifiedClient.searchCalled:
			// Background call was made
		case <-time.After(100 * time.Millisecond):
			t.Fatal("Background unified client call was not made within timeout")
		}

		dual.AssertExpectations(t)
		legacyClient.AssertExpectations(t)
		unifiedClient.AssertExpectations(t)
	})

	t.Run("handles background call error gracefully", func(t *testing.T) {
		ctx := testutil.NewDefaultTestContext(t)
		dual := &MockDualWriter{}
		featuresWithFlag := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchDualReaderEnabled)

		dual.On("ReadFromUnified", mock.Anything, gr).Return(false, nil)
		legacyClient.On("Search", mock.Anything, req, mock.Anything).Return(expectedResponse, nil)

		// Background call returns error - should be handled gracefully
		unifiedClient.On("Search", mock.Anything, req, mock.Anything).Return((*resourcepb.ResourceSearchResponse)(nil), assert.AnError)

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, featuresWithFlag, gr)

		resp, err := wrapper.Search(ctx, req)

		// Main request should still succeed despite background error
		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)

		// Wait for background goroutine to complete
		select {
		case <-unifiedClient.searchCalled:
			// Background call was made (even though it failed)
		case <-time.After(100 * time.Millisecond):
			t.Fatal("Background unified client call was not made within timeout")
		}

		dual.AssertExpectations(t)
		legacyClient.AssertExpectations(t)
		unifiedClient.AssertExpectations(t)
	})
}

func TestSearchWrapper_GetStats(t *testing.T) {
	gr, unifiedClient, legacyClient, features := setupTestSearchClient(t)
	req := &resourcepb.ResourceStatsRequest{Namespace: "test"}
	expectedResponse := &resourcepb.ResourceStatsResponse{Stats: []*resourcepb.ResourceStatsResponse_Stats{{Count: 100}}}

	t.Run("uses unified client when reading from unified", func(t *testing.T) {
		ctx := testutil.NewDefaultTestContext(t)
		dual := &MockDualWriter{}

		dual.On("ReadFromUnified", mock.Anything, gr).Return(true, nil)
		unifiedClient.On("GetStats", mock.Anything, req, mock.Anything).Return(expectedResponse, nil)

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, features, gr)

		resp, err := wrapper.GetStats(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)

		dual.AssertExpectations(t)
		unifiedClient.AssertExpectations(t)
		legacyClient.AssertNotCalled(t, "GetStats")
	})

	t.Run("makes background call to unified when feature flag enabled and using legacy", func(t *testing.T) {
		ctx := testutil.NewDefaultTestContext(t)
		dual := &MockDualWriter{}
		featuresWithFlag := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchDualReaderEnabled)

		dual.On("ReadFromUnified", mock.Anything, gr).Return(false, nil)
		legacyClient.On("GetStats", mock.Anything, req, mock.Anything).Return(expectedResponse, nil)

		// Expect background call to unified client
		unifiedBgResponse := &resourcepb.ResourceStatsResponse{Stats: []*resourcepb.ResourceStatsResponse_Stats{{Count: 50}}}
		unifiedClient.On("GetStats", mock.Anything, req, mock.Anything).Return(unifiedBgResponse, nil)

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, featuresWithFlag, gr)

		resp, err := wrapper.GetStats(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)

		// Wait for background goroutine to complete
		select {
		case <-unifiedClient.statsCalled:
			// Background call was made
		case <-time.After(100 * time.Millisecond):
			t.Fatal("Background unified client GetStats call was not made within timeout")
		}

		dual.AssertExpectations(t)
		legacyClient.AssertExpectations(t)
		unifiedClient.AssertExpectations(t)
	})
}
