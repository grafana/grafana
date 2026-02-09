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
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
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

func TestIntegration_FolderTreeCache(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	t.Run("GetAll calls GetFolders once and caches across requests", func(t *testing.T) {
		sc := setupTestScenario(t)

		// Create multiple library panels
		for i := 0; i < 5; i++ {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Panel "+string(rune('A'+i)))
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		}

		// Replace folder service with tracking one
		trackingSvc := newTrackingFolderService()
		trackingSvc.ExpectedFolders = []*folder.Folder{sc.folder}
		trackingSvc.AddFolder(sc.folder)

		originalFolderSvc := sc.service.folderService
		sc.service.folderService = trackingSvc
		sc.service.treeCache = newFolderTreeCache(trackingSvc)
		defer func() { sc.service.folderService = originalFolderSvc }()

		// First request
		resp := sc.service.getAllHandler(sc.reqContext)
		require.Equal(t, 200, resp.Status())

		var result libraryElementsSearch
		err := json.Unmarshal(resp.Body(), &result)
		require.NoError(t, err)
		require.Equal(t, int64(5), result.Result.TotalCount)
		assert.Equal(t, 1, trackingSvc.GetCallCount(), "GetFolders should be called once for tree build")

		// Second request reuses global cache
		resp = sc.service.getAllHandler(sc.reqContext)
		require.Equal(t, 200, resp.Status())
		assert.Equal(t, 1, trackingSvc.GetCallCount(), "Second request should reuse cached tree")
	})
}

func TestFolderTreeCache_Unit(t *testing.T) {
	t.Run("builds tree from GetFolders result", func(t *testing.T) {
		sc := setupTestScenario(t)

		fakeSvc := foldertest.NewFakeService()
		fakeSvc.ExpectedFolders = []*folder.Folder{
			{UID: "folder-a", Title: "Folder A", OrgID: 1},
			{UID: "folder-b", Title: "Folder B", OrgID: 1, ParentUID: "folder-a"},
		}

		cache := newFolderTreeCache(fakeSvc)
		tree, err := cache.get(context.Background(), sc.reqContext.SignedInUser)
		require.NoError(t, err)
		require.NotNil(t, tree)

		assert.True(t, tree.Contains("folder-a"))
		assert.True(t, tree.Contains("folder-b"))
		assert.Equal(t, "Folder A", tree.GetTitle("folder-a"))
		assert.Equal(t, "Folder B", tree.GetTitle("folder-b"))
	})

	t.Run("caches tree and returns same instance on repeated calls", func(t *testing.T) {
		sc := setupTestScenario(t)

		trackingSvc := newTrackingFolderService()
		trackingSvc.ExpectedFolders = []*folder.Folder{
			{UID: "folder-a", Title: "Folder A", OrgID: 1},
		}

		cache := newFolderTreeCache(trackingSvc)
		ctx := context.Background()

		tree1, err := cache.get(ctx, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 1, trackingSvc.GetCallCount())

		tree2, err := cache.get(ctx, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 1, trackingSvc.GetCallCount(), "Should not call GetFolders again within TTL")
		assert.Same(t, tree1, tree2, "Should return same cached tree instance")
	})

	t.Run("different user gets separate cache entry", func(t *testing.T) {
		sc := setupTestScenario(t)

		trackingSvc := newTrackingFolderService()
		trackingSvc.ExpectedFolders = []*folder.Folder{
			{UID: "folder-a", Title: "Folder A", OrgID: 1},
		}

		cache := newFolderTreeCache(trackingSvc)
		ctx := context.Background()

		// First user fetches and caches tree
		_, err := cache.get(ctx, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 1, trackingSvc.GetCallCount())

		// Same user reuses cache
		_, err = cache.get(ctx, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 1, trackingSvc.GetCallCount(), "Same user should reuse cache")

		// Different user triggers a new GetFolders call
		user2 := &user.SignedInUser{
			UserID:  999,
			UserUID: "different-user-uid",
			OrgID:   sc.reqContext.GetOrgID(),
			OrgRole: org.RoleViewer,
		}
		_, err = cache.get(ctx, user2)
		require.NoError(t, err)
		assert.Equal(t, 2, trackingSvc.GetCallCount(), "Different user should trigger a new GetFolders call")
	})
}

func TestCacheKey(t *testing.T) {
	t.Run("withCache adds cache key to context", func(t *testing.T) {
		ctx := withCache(context.Background())
		assert.True(t, hasCache(ctx))
	})

	t.Run("hasCache returns false when not set", func(t *testing.T) {
		assert.False(t, hasCache(context.Background()))
	})
}
