package libraryelements

import (
	"context"
	"encoding/json"
	"sync/atomic"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/util/testutil"
)

// trackingFolderService wraps a folder.Service and tracks how many times GetFolders is called.
type trackingFolderService struct {
	*foldertest.FakeService
	getFoldersCallCount atomic.Int32
}

func newTrackingFolderService() *trackingFolderService {
	return &trackingFolderService{
		FakeService: foldertest.NewFakeService(),
	}
}

func (s *trackingFolderService) GetFolders(ctx context.Context, q folder.GetFoldersQuery) ([]*folder.Folder, error) {
	s.getFoldersCallCount.Add(1)
	return s.FakeService.GetFolders(ctx, q)
}

func (s *trackingFolderService) GetCallCount() int {
	return int(s.getFoldersCallCount.Load())
}

func (s *trackingFolderService) ResetCallCount() {
	s.getFoldersCallCount.Store(0)
}

func TestIntegration_FolderTreeCache_RequestScoped(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("GetAll uses cached folder tree within same request", func(t *testing.T) {
		// Setup test scenario
		sc := setupTestScenario(t)

		// Create multiple library panels in the folder FIRST (using original folder service)
		for i := 0; i < 5; i++ {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Panel "+string(rune('A'+i)))
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		}

		// Now create a tracking folder service and replace the one in the service
		trackingSvc := newTrackingFolderService()
		trackingSvc.ExpectedFolders = []*folder.Folder{sc.folder}
		trackingSvc.AddFolder(sc.folder)

		// Replace the folder service with our tracking one (for GetAll only)
		originalFolderSvc := sc.service.folderService
		sc.service.folderService = trackingSvc
		// Also update the treeCache to use the tracking service
		sc.service.treeCache = newFolderTreeCache(trackingSvc)
		defer func() {
			sc.service.folderService = originalFolderSvc
		}()

		// Call getAllHandler which should use the cached folder tree
		resp := sc.service.getAllHandler(sc.reqContext)
		require.Equal(t, 200, resp.Status())

		var result libraryElementsSearch
		err := json.Unmarshal(resp.Body(), &result)
		require.NoError(t, err)

		// Verify we got all panels back
		require.Equal(t, int64(5), result.Result.TotalCount)

		// GetFolders should have been called exactly once for building the tree,
		// not once per panel for permission checks
		callCount := trackingSvc.GetCallCount()
		assert.Equal(t, 1, callCount, "GetFolders should be called exactly once per request due to caching")
	})

	t.Run("Different requests use separate cache entries", func(t *testing.T) {
		sc := setupTestScenario(t)

		// Create a library panel FIRST
		// nolint:staticcheck
		command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Test Panel")
		sc.reqContext.Req.Body = mockRequestBody(command)
		resp := sc.service.createHandler(sc.reqContext)
		require.Equal(t, 200, resp.Status())

		// Now create a tracking folder service
		trackingSvc := newTrackingFolderService()
		trackingSvc.ExpectedFolders = []*folder.Folder{sc.folder}
		trackingSvc.AddFolder(sc.folder)

		originalFolderSvc := sc.service.folderService
		sc.service.folderService = trackingSvc
		sc.service.treeCache = newFolderTreeCache(trackingSvc)
		defer func() {
			sc.service.folderService = originalFolderSvc
		}()

		// First request
		resp = sc.service.getAllHandler(sc.reqContext)
		require.Equal(t, 200, resp.Status())
		firstCallCount := trackingSvc.GetCallCount()
		assert.Equal(t, 1, firstCallCount, "First request should call GetFolders once")

		// Second request (should build a new cache entry since it's a different request ID)
		resp = sc.service.getAllHandler(sc.reqContext)
		require.Equal(t, 200, resp.Status())
		secondCallCount := trackingSvc.GetCallCount()
		assert.Equal(t, 2, secondCallCount, "Second request should call GetFolders again (different request ID)")
	})

	t.Run("Cache key includes user UID for isolation", func(t *testing.T) {
		sc := setupTestScenario(t)

		// Create a library panel FIRST
		// nolint:staticcheck
		command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Test Panel")
		sc.reqContext.Req.Body = mockRequestBody(command)
		resp := sc.service.createHandler(sc.reqContext)
		require.Equal(t, 200, resp.Status())

		// Now set up tracking
		trackingSvc := newTrackingFolderService()
		trackingSvc.ExpectedFolders = []*folder.Folder{sc.folder}
		trackingSvc.AddFolder(sc.folder)

		originalFolderSvc := sc.service.folderService
		sc.service.folderService = trackingSvc
		sc.service.treeCache = newFolderTreeCache(trackingSvc)
		defer func() {
			sc.service.folderService = originalFolderSvc
		}()

		// Call GetAll - tree should be built
		resp = sc.service.getAllHandler(sc.reqContext)
		require.Equal(t, 200, resp.Status())

		callCount := trackingSvc.GetCallCount()
		assert.GreaterOrEqual(t, callCount, 1, "GetFolders should be called at least once")
	})
}

func TestFolderTreeCache_Unit(t *testing.T) {
	t.Run("get builds tree from GetFolders result", func(t *testing.T) {
		sc := setupTestScenario(t)

		fakeSvc := foldertest.NewFakeService()
		folders := []*folder.Folder{
			{UID: "folder-a", Title: "Folder A", OrgID: 1},
			{UID: "folder-b", Title: "Folder B", OrgID: 1, ParentUID: "folder-a"},
		}
		fakeSvc.ExpectedFolders = folders

		cache := newFolderTreeCache(fakeSvc)

		// Get tree without request ID (should not cache)
		ctx := context.Background()
		tree, err := cache.get(ctx, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		require.NotNil(t, tree)

		// Verify tree structure
		assert.True(t, tree.Contains("folder-a"))
		assert.True(t, tree.Contains("folder-b"))
		assert.Equal(t, "Folder A", tree.GetTitle("folder-a"))
		assert.Equal(t, "Folder B", tree.GetTitle("folder-b"))
	})

	t.Run("get caches tree when request ID is present", func(t *testing.T) {
		sc := setupTestScenario(t)

		trackingSvc := newTrackingFolderService()
		trackingSvc.ExpectedFolders = []*folder.Folder{
			{UID: "folder-a", Title: "Folder A", OrgID: 1},
		}

		cache := newFolderTreeCache(trackingSvc)

		// Create context with request ID
		ctx := withRequestCacheID(context.Background(), "request-123")

		// First call - should fetch from service
		tree1, err := cache.get(ctx, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		require.NotNil(t, tree1)
		assert.Equal(t, 1, trackingSvc.GetCallCount())

		// Second call with same request ID - should use cache
		tree2, err := cache.get(ctx, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		require.NotNil(t, tree2)
		assert.Equal(t, 1, trackingSvc.GetCallCount(), "Should not call GetFolders again")

		// Trees should be the same instance
		assert.Same(t, tree1, tree2, "Should return same cached tree")
	})

	t.Run("get does not cache when request ID is empty", func(t *testing.T) {
		sc := setupTestScenario(t)

		trackingSvc := newTrackingFolderService()
		trackingSvc.ExpectedFolders = []*folder.Folder{
			{UID: "folder-a", Title: "Folder A", OrgID: 1},
		}

		cache := newFolderTreeCache(trackingSvc)

		// Context without request ID
		ctx := context.Background()

		// First call
		_, err := cache.get(ctx, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 1, trackingSvc.GetCallCount())

		// Second call - should fetch again since not cached
		_, err = cache.get(ctx, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 2, trackingSvc.GetCallCount(), "Should call GetFolders again without request ID")
	})

	t.Run("different request IDs use different cache entries", func(t *testing.T) {
		sc := setupTestScenario(t)

		trackingSvc := newTrackingFolderService()
		trackingSvc.ExpectedFolders = []*folder.Folder{
			{UID: "folder-a", Title: "Folder A", OrgID: 1},
		}

		cache := newFolderTreeCache(trackingSvc)

		// First request
		ctx1 := withRequestCacheID(context.Background(), "request-1")
		_, err := cache.get(ctx1, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 1, trackingSvc.GetCallCount())

		// Same request ID - should use cache
		_, err = cache.get(ctx1, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 1, trackingSvc.GetCallCount())

		// Different request ID - should fetch again
		ctx2 := withRequestCacheID(context.Background(), "request-2")
		_, err = cache.get(ctx2, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 2, trackingSvc.GetCallCount())
	})
}

func TestRequestCacheID(t *testing.T) {
	t.Run("withRequestCacheID adds ID to context", func(t *testing.T) {
		ctx := context.Background()
		ctxWithID := withRequestCacheID(ctx, "test-id-123")

		id := getRequestCacheID(ctxWithID)
		assert.Equal(t, "test-id-123", id)
	})

	t.Run("getRequestCacheID returns empty string when not set", func(t *testing.T) {
		ctx := context.Background()
		id := getRequestCacheID(ctx)
		assert.Equal(t, "", id)
	})
}
