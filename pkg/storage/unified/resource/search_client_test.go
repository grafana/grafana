package resource

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// fakeDualWriter is a hand-written fake for the DualWriter interface.
type fakeDualWriter struct {
	readFromUnified bool
	status          dualwrite.StorageStatus
}

func (f *fakeDualWriter) ReadFromUnified(_ context.Context, _ schema.GroupResource) (bool, error) {
	return f.readFromUnified, nil
}

func (f *fakeDualWriter) Status(_ context.Context, _ schema.GroupResource) (dualwrite.StorageStatus, error) {
	return f.status, nil
}

// fakeResourceIndexClient is a hand-written fake for resourcepb.ResourceIndexClient.
type fakeResourceIndexClient struct {
	searchResponse *resourcepb.ResourceSearchResponse
	searchErr      error
	searchDelay    time.Duration
	searchCalled   chan struct{}

	statsResponse *resourcepb.ResourceStatsResponse
	statsErr      error
	statsDelay    time.Duration
	statsCalled   chan struct{}

	rebuildResponse *resourcepb.RebuildIndexesResponse
	rebuildErr      error

	contextCanceled chan context.Context
}

func newFakeResourceIndexClient() *fakeResourceIndexClient {
	return &fakeResourceIndexClient{
		searchCalled:    make(chan struct{}, 10),
		statsCalled:     make(chan struct{}, 10),
		contextCanceled: make(chan context.Context, 10),
	}
}

func (f *fakeResourceIndexClient) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	if f.searchDelay > 0 {
		select {
		case <-time.After(f.searchDelay):
		case <-ctx.Done():
			f.contextCanceled <- ctx
			return nil, ctx.Err()
		}
	}

	select {
	case f.searchCalled <- struct{}{}:
	default:
	}

	return f.searchResponse, f.searchErr
}

func (f *fakeResourceIndexClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	if f.statsDelay > 0 {
		select {
		case <-time.After(f.statsDelay):
		case <-ctx.Done():
			f.contextCanceled <- ctx
			return nil, ctx.Err()
		}
	}

	select {
	case f.statsCalled <- struct{}{}:
	default:
	}

	return f.statsResponse, f.statsErr
}

func (f *fakeResourceIndexClient) RebuildIndexes(ctx context.Context, in *resourcepb.RebuildIndexesRequest, opts ...grpc.CallOption) (*resourcepb.RebuildIndexesResponse, error) {
	return f.rebuildResponse, f.rebuildErr
}

func (f *fakeResourceIndexClient) VectorSearch(ctx context.Context, in *resourcepb.VectorSearchRequest, opts ...grpc.CallOption) (*resourcepb.VectorSearchResponse, error) {
	return nil, nil
}

func (f *fakeResourceIndexClient) HybridSearch(ctx context.Context, in *resourcepb.HybridSearchRequest, opts ...grpc.CallOption) (*resourcepb.HybridSearchResponse, error) {
	return nil, nil
}

func setupTestSearchClient(t *testing.T) (schema.GroupResource, *fakeResourceIndexClient, *fakeResourceIndexClient) {
	t.Helper()
	gr := schema.GroupResource{Group: "test", Resource: "items"}
	unifiedClient := newFakeResourceIndexClient()
	legacyClient := newFakeResourceIndexClient()
	return gr, unifiedClient, legacyClient
}

func setupTestSearchWrapper(t *testing.T, dual *fakeDualWriter, unifiedClient, legacyClient *fakeResourceIndexClient, gr schema.GroupResource) *searchWrapper {
	t.Helper()
	return &searchWrapper{
		dual:          dual,
		groupResource: gr,
		unifiedClient: unifiedClient,
		legacyClient:  legacyClient,
		logger:        log.NewNopLogger(),
	}
}

func TestSearchClient_NewSearchClient(t *testing.T) {
	gr, unifiedClient, legacyClient := setupTestSearchClient(t)

	t.Run("always returns wrapper", func(t *testing.T) {
		dual := &fakeDualWriter{}

		client := NewSearchClient(dual, gr, unifiedClient, legacyClient)

		wrapper, ok := client.(*searchWrapper)
		require.True(t, ok)
		assert.Equal(t, dual, wrapper.dual)
		assert.Equal(t, gr, wrapper.groupResource)
		assert.Equal(t, unifiedClient, wrapper.unifiedClient)
		assert.Equal(t, legacyClient, wrapper.legacyClient)
	})
}

func TestSearchWrapper_Search(t *testing.T) {
	req := &resourcepb.ResourceSearchRequest{Query: "test"}
	expectedResponse := &resourcepb.ResourceSearchResponse{TotalHits: 0}

	t.Run("uses unified client when reading from unified", func(t *testing.T) {
		gr, unifiedClient, legacyClient := setupTestSearchClient(t)

		ctx := testutil.NewDefaultTestContext(t)
		dual := &fakeDualWriter{readFromUnified: true, status: dualwrite.StorageStatus{ReadUnified: true, WriteUnified: true}}

		unifiedClient.searchResponse = expectedResponse

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, gr)

		resp, err := wrapper.Search(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)

		assert.Empty(t, legacyClient.searchCalled, "legacy Search should not have been called")
	})

	t.Run("uses legacy client when not reading from unified", func(t *testing.T) {
		gr, unifiedClient, legacyClient := setupTestSearchClient(t)

		ctx := testutil.NewDefaultTestContext(t)
		dual := &fakeDualWriter{readFromUnified: false, status: dualwrite.StorageStatus{ReadUnified: false, WriteUnified: true}}

		legacyClient.searchResponse = expectedResponse

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, gr)

		resp, err := wrapper.Search(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)
	})

	t.Run("does not make background call when not dual writing", func(t *testing.T) {
		gr, unifiedClient, legacyClient := setupTestSearchClient(t)

		ctx := testutil.NewDefaultTestContext(t)
		dual := &fakeDualWriter{readFromUnified: false, status: dualwrite.StorageStatus{ReadUnified: false, WriteUnified: false}}

		legacyClient.searchResponse = expectedResponse

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, gr)

		resp, err := wrapper.Search(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)

		// Expect call to legacy client
		assert.Len(t, legacyClient.searchCalled, 1, "legacy Search should have been called")

		// Do not expect background call to unified client
		assert.Empty(t, unifiedClient.searchCalled, "unified Search should not have been called")
	})
}

func TestSearchWrapper_GetStats(t *testing.T) {
	req := &resourcepb.ResourceStatsRequest{Namespace: "test"}
	expectedResponse := &resourcepb.ResourceStatsResponse{Stats: []*resourcepb.ResourceStatsResponse_Stats{{Count: 100}}}

	t.Run("uses unified client when reading from unified", func(t *testing.T) {
		gr, unifiedClient, legacyClient := setupTestSearchClient(t)

		ctx := testutil.NewDefaultTestContext(t)
		dual := &fakeDualWriter{readFromUnified: true, status: dualwrite.StorageStatus{ReadUnified: true, WriteUnified: true}}

		unifiedClient.statsResponse = expectedResponse

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, gr)

		resp, err := wrapper.GetStats(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)

		assert.Empty(t, legacyClient.statsCalled, "legacy GetStats should not have been called")
	})

	t.Run("does not make background call when not dual writing", func(t *testing.T) {
		gr, unifiedClient, legacyClient := setupTestSearchClient(t)

		ctx := testutil.NewDefaultTestContext(t)
		dual := &fakeDualWriter{readFromUnified: false, status: dualwrite.StorageStatus{ReadUnified: false, WriteUnified: false}}

		legacyClient.statsResponse = expectedResponse

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, gr)

		resp, err := wrapper.GetStats(ctx, req)

		require.NoError(t, err)
		assert.Equal(t, expectedResponse, resp)

		// Expect call to legacy client
		assert.Len(t, legacyClient.statsCalled, 1, "legacy GetStats should have been called")

		// Do not expect background call to unified client
		assert.Empty(t, unifiedClient.statsCalled, "unified GetStats should not have been called")
	})

	t.Run("makes background call to unified when dual writing with legacy primary", func(t *testing.T) {
		gr, unifiedClient, legacyClient := setupTestSearchClient(t)

		ctx := testutil.NewDefaultTestContext(t)
		dual := &fakeDualWriter{readFromUnified: false, status: dualwrite.StorageStatus{ReadUnified: false, WriteUnified: true}}

		legacyClient.statsResponse = expectedResponse

		// Configure background call to unified client
		unifiedClient.statsResponse = &resourcepb.ResourceStatsResponse{Stats: []*resourcepb.ResourceStatsResponse_Stats{{Count: 50}}}

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, gr)

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
	})

	t.Run("background GetStats request times out after 500ms", func(t *testing.T) {
		gr, unifiedClient, legacyClient := setupTestSearchClient(t)

		ctx := testutil.NewDefaultTestContext(t)
		dual := &fakeDualWriter{readFromUnified: false, status: dualwrite.StorageStatus{ReadUnified: false, WriteUnified: true}}

		legacyClient.statsResponse = expectedResponse

		// Configure unified client to take longer than the 500ms timeout
		unifiedClient.statsDelay = 600 * time.Millisecond // Longer than 500ms timeout

		wrapper := setupTestSearchWrapper(t, dual, unifiedClient, legacyClient, gr)

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
	})
}
