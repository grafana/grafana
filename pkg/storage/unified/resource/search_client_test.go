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

// Mock ResourceIndexClient with enhanced timeout testing capabilities
type MockResourceIndexClient struct {
	mock.Mock
	searchCalled    chan struct{}
	statsCalled     chan struct{}
	searchDelay     time.Duration
	statsDelay      time.Duration
	contextCanceled chan context.Context
}

func NewMockResourceIndexClient() *MockResourceIndexClient {
	return &MockResourceIndexClient{
		searchCalled:    make(chan struct{}, 1),
		statsCalled:     make(chan struct{}, 1),
		contextCanceled: make(chan context.Context, 10), // Buffer for multiple calls
	}
}

func (m *MockResourceIndexClient) SetSearchDelay(delay time.Duration) {
	m.searchDelay = delay
}

func (m *MockResourceIndexClient) SetStatsDelay(delay time.Duration) {
	m.statsDelay = delay
}

func (m *MockResourceIndexClient) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	args := m.Called(ctx, in, opts)

	// Simulate delay if configured
	if m.searchDelay > 0 {
		select {
		case <-time.After(m.searchDelay):
			// Delay completed normally
		case <-ctx.Done():
			// Context was canceled during delay
			m.contextCanceled <- ctx
			return nil, ctx.Err()
		}
	}

	// Signal that Search was called
	select {
	case m.searchCalled <- struct{}{}:
	default:
	}

	return args.Get(0).(*resourcepb.ResourceSearchResponse), args.Error(1)
}

func (m *MockResourceIndexClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	args := m.Called(ctx, in, opts)

	// Simulate delay if configured
	if m.statsDelay > 0 {
		select {
		case <-time.After(m.statsDelay):
			// Delay completed normally
		case <-ctx.Done():
			// Context was canceled during delay
			m.contextCanceled <- ctx
			return nil, ctx.Err()
		}
	}

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

	t.Run("always returns wrapper", func(t *testing.T) {
		dual := &MockDualWriter{} // Create fresh mock for this test

		client := NewSearchClient(dual, gr, unifiedClient, legacyClient, features)

		wrapper, ok := client.(*searchWrapper)
		require.True(t, ok)
		assert.Equal(t, dual, wrapper.dual)
		assert.Equal(t, gr, wrapper.groupResource)
		assert.Equal(t, unifiedClient, wrapper.unifiedClient)
		assert.Equal(t, legacyClient, wrapper.legacyClient)
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

	t.Run("background request times out after 500ms", func(t *testing.T) {
		ctx := testutil.NewDefaultTestContext(t)
		dual := &MockDualWriter{}
		featuresWithFlag := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchDualReaderEnabled)

		dual.On("ReadFromUnified", mock.Anything, gr).Return(false, nil)
		legacyClient.On("Search", mock.Anything, req, mock.Anything).Return(expectedResponse, nil)

		// Configure unified client to take longer than the 500ms timeout
		unifiedClient.SetSearchDelay(600 * time.Millisecond) // Longer than 500ms timeout
		unifiedClient.On("Search", mock.Anything, req, mock.Anything).Return((*resourcepb.ResourceSearchResponse)(nil), context.DeadlineExceeded)

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, featuresWithFlag, gr)

		start := time.Now()
		resp, err := wrapper.Search(ctx, req)
		mainRequestDuration := time.Since(start)

		// Main request should succeed quickly despite background timeout
		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)
		assert.Less(t, mainRequestDuration, 50*time.Millisecond, "Main request should not be blocked by background timeout")

		// Wait for background context to be canceled
		select {
		case canceledCtx := <-unifiedClient.contextCanceled:
			assert.Error(t, canceledCtx.Err(), "Background context should be canceled")
			assert.Equal(t, context.DeadlineExceeded, canceledCtx.Err())
		case <-time.After(700 * time.Millisecond):
			t.Fatal("Background request should have been canceled due to timeout")
		}

		dual.AssertExpectations(t)
		legacyClient.AssertExpectations(t)
		unifiedClient.AssertExpectations(t)
	})

	t.Run("background request completes successfully when within timeout", func(t *testing.T) {
		ctx := testutil.NewDefaultTestContext(t)
		dual := &MockDualWriter{}
		featuresWithFlag := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchDualReaderEnabled)

		dual.On("ReadFromUnified", mock.Anything, gr).Return(false, nil)
		legacyClient.On("Search", mock.Anything, req, mock.Anything).Return(expectedResponse, nil)

		// Configure unified client to respond within the 500ms timeout
		unifiedClient.SetSearchDelay(100 * time.Millisecond) // Well within 500ms timeout
		unifiedClient.On("Search", mock.Anything, req, mock.Anything).Return(&resourcepb.ResourceSearchResponse{TotalHits: 0}, nil)

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, featuresWithFlag, gr)

		start := time.Now()
		resp, err := wrapper.Search(ctx, req)
		mainRequestDuration := time.Since(start)

		// Main request should succeed quickly
		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)
		assert.Less(t, mainRequestDuration, 50*time.Millisecond, "Main request should not be blocked")

		// Wait for successful background call
		select {
		case <-unifiedClient.searchCalled:
			// Background call completed successfully
		case <-time.After(200 * time.Millisecond):
			t.Fatal("Expected successful background call")
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

	t.Run("background GetStats request times out after 500ms", func(t *testing.T) {
		ctx := testutil.NewDefaultTestContext(t)
		dual := &MockDualWriter{}
		featuresWithFlag := featuremgmt.WithFeatures(featuremgmt.FlagUnifiedStorageSearchDualReaderEnabled)

		dual.On("ReadFromUnified", mock.Anything, gr).Return(false, nil)
		legacyClient.On("GetStats", mock.Anything, req, mock.Anything).Return(expectedResponse, nil)

		// Configure unified client to take longer than the 500ms timeout
		unifiedClient.SetStatsDelay(600 * time.Millisecond) // Longer than 500ms timeout
		unifiedClient.On("GetStats", mock.Anything, req, mock.Anything).Return((*resourcepb.ResourceStatsResponse)(nil), context.DeadlineExceeded)

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, featuresWithFlag, gr)

		start := time.Now()
		resp, err := wrapper.GetStats(ctx, req)
		mainRequestDuration := time.Since(start)

		// Main request should succeed quickly despite background timeout
		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)
		assert.Less(t, mainRequestDuration, 50*time.Millisecond, "Main request should not be blocked by background timeout")

		// Wait for background context to be canceled
		select {
		case canceledCtx := <-unifiedClient.contextCanceled:
			assert.Error(t, canceledCtx.Err(), "Background context should be canceled")
			assert.Equal(t, context.DeadlineExceeded, canceledCtx.Err())
		case <-time.After(700 * time.Millisecond):
			t.Fatal("Background request should have been canceled due to timeout")
		}

		dual.AssertExpectations(t)
		legacyClient.AssertExpectations(t)
		unifiedClient.AssertExpectations(t)
	})
}

func TestExtractUIDs(t *testing.T) {
	tests := []struct {
		name     string
		response *resourcepb.ResourceSearchResponse
		expected map[string]struct{}
	}{
		{
			name:     "nil response",
			response: nil,
			expected: map[string]struct{}{},
		},
		{
			name: "empty results",
			response: &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{},
				},
			},
			expected: map[string]struct{}{},
		},
		{
			name: "single result",
			response: &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{
							Key: &resourcepb.ResourceKey{
								Name: "test-uid-1",
							},
						},
					},
				},
			},
			expected: map[string]struct{}{"test-uid-1": struct{}{}},
		},
		{
			name: "multiple results",
			response: &resourcepb.ResourceSearchResponse{
				Results: &resourcepb.ResourceTable{
					Rows: []*resourcepb.ResourceTableRow{
						{
							Key: &resourcepb.ResourceKey{
								Name: "test-uid-1",
							},
						},
						{
							Key: &resourcepb.ResourceKey{
								Name: "test-uid-2",
							},
						},
					},
				},
			},
			expected: map[string]struct{}{"test-uid-1": struct{}{}, "test-uid-2": struct{}{}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractUIDs(tt.response)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestCalculateMatchPercentage(t *testing.T) {
	tests := []struct {
		name        string
		legacyUIDs  map[string]struct{}
		unifiedUIDs map[string]struct{}
		expected    float64
	}{
		{
			name:        "both empty",
			legacyUIDs:  map[string]struct{}{},
			unifiedUIDs: map[string]struct{}{},
			expected:    100.0,
		},
		{
			name:        "legacy empty, unified has results",
			legacyUIDs:  map[string]struct{}{},
			unifiedUIDs: map[string]struct{}{"uid1": struct{}{}},
			expected:    0.0,
		},
		{
			name:        "legacy has results, unified empty",
			legacyUIDs:  map[string]struct{}{"uid1": struct{}{}},
			unifiedUIDs: map[string]struct{}{},
			expected:    0.0,
		},
		{
			name:        "perfect match",
			legacyUIDs:  map[string]struct{}{"uid1": struct{}{}, "uid2": struct{}{}},
			unifiedUIDs: map[string]struct{}{"uid1": struct{}{}, "uid2": struct{}{}},
			expected:    100.0,
		},
		{
			name:        "partial match",
			legacyUIDs:  map[string]struct{}{"uid1": struct{}{}, "uid2": struct{}{}},
			unifiedUIDs: map[string]struct{}{"uid1": struct{}{}, "uid3": struct{}{}},
			expected:    33.33333333333333, // 1 match out of 3 unique UIDs
		},
		{
			name:        "no match",
			legacyUIDs:  map[string]struct{}{"uid1": struct{}{}, "uid2": struct{}{}},
			unifiedUIDs: map[string]struct{}{"uid3": struct{}{}, "uid4": struct{}{}},
			expected:    0.0,
		},
		{
			name:        "legacy subset of unified",
			legacyUIDs:  map[string]struct{}{"uid1": struct{}{}},
			unifiedUIDs: map[string]struct{}{"uid1": struct{}{}, "uid2": struct{}{}},
			expected:    50.0, // 1 match out of 2 unique UIDs
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculateMatchPercentage(tt.legacyUIDs, tt.unifiedUIDs)
			assert.InDelta(t, tt.expected, result, 0.001)
		})
	}
}
