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
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
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

	t.Run("GetAll calls GetFolders once per request and rebuilds on the next", func(t *testing.T) {
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

		// First request builds the tree exactly once, even though the tree is
		// needed once for the response plus once per panel in the permission
		// resolver (the request-scoped holder collapses those N+1 lookups).
		resp := sc.service.getAllHandler(sc.reqContext)
		require.Equal(t, 200, resp.Status())

		var result libraryElementsSearch
		err := json.Unmarshal(resp.Body(), &result)
		require.NoError(t, err)
		require.Equal(t, int64(5), result.Result.TotalCount)
		assert.Equal(t, 1, trackingSvc.GetCallCount(), "GetFolders should be called once per request for tree build")

		// A second request must rebuild the tree so folder changes are reflected
		// immediately rather than being masked by a stale cross-request cache.
		resp = sc.service.getAllHandler(sc.reqContext)
		require.Equal(t, 200, resp.Status())
		assert.Equal(t, 2, trackingSvc.GetCallCount(), "Second request should rebuild the tree, not reuse a stale one")
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

	t.Run("memoizes tree within a request and returns same instance", func(t *testing.T) {
		sc := setupTestScenario(t)

		trackingSvc := newTrackingFolderService()
		trackingSvc.ExpectedFolders = []*folder.Folder{
			{UID: "folder-a", Title: "Folder A", OrgID: 1},
		}

		cache := newFolderTreeCache(trackingSvc)
		ctx := withCache(context.Background())

		tree1, err := cache.get(ctx, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 1, trackingSvc.GetCallCount())

		tree2, err := cache.get(ctx, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 1, trackingSvc.GetCallCount(), "Should reuse the memoized tree within the same request")
		assert.Same(t, tree1, tree2, "Should return same memoized tree instance")
	})

	t.Run("does not memoize across requests", func(t *testing.T) {
		sc := setupTestScenario(t)

		trackingSvc := newTrackingFolderService()
		trackingSvc.ExpectedFolders = []*folder.Folder{
			{UID: "folder-a", Title: "Folder A", OrgID: 1},
		}

		cache := newFolderTreeCache(trackingSvc)

		// Each request carries its own holder, so each rebuilds a fresh tree.
		_, err := cache.get(withCache(context.Background()), sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 1, trackingSvc.GetCallCount())

		_, err = cache.get(withCache(context.Background()), sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 2, trackingSvc.GetCallCount(), "A new request should rebuild the tree and see fresh folders")
	})

	t.Run("does not reuse a tree across different users in the same context", func(t *testing.T) {
		sc := setupTestScenario(t)

		trackingSvc := newTrackingFolderService()
		trackingSvc.ExpectedFolders = []*folder.Folder{
			{UID: "folder-a", Title: "Folder A", OrgID: 1},
		}

		cache := newFolderTreeCache(trackingSvc)
		ctx := withCache(context.Background())

		// First user fetches and memoizes tree
		_, err := cache.get(ctx, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 1, trackingSvc.GetCallCount())

		// Same user reuses the memoized tree
		_, err = cache.get(ctx, sc.reqContext.SignedInUser)
		require.NoError(t, err)
		assert.Equal(t, 1, trackingSvc.GetCallCount(), "Same user should reuse the memoized tree")

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

func TestIntegration_SkipFolderTreeForAdmin(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	createPanels := func(t *testing.T, sc scenarioContext, count int) {
		t.Helper()
		for i := 0; i < count; i++ {
			// nolint:staticcheck
			command := getCreatePanelCommand(sc.folder.ID, sc.folder.UID, "Panel "+string(rune('A'+i)))
			sc.reqContext.Req.Body = mockRequestBody(command)
			resp := sc.service.createHandler(sc.reqContext)
			require.Equal(t, 200, resp.Status())
		}
	}

	replaceWithTrackingFolderSvc := func(sc scenarioContext) *trackingFolderService {
		trackingSvc := newTrackingFolderService()
		trackingSvc.ExpectedFolders = []*folder.Folder{sc.folder}
		trackingSvc.AddFolder(sc.folder)
		sc.service.folderService = trackingSvc
		sc.service.treeCache = newFolderTreeCache(trackingSvc)
		return trackingSvc
	}

	t.Run("admin with SkipFolderTreeForAdmin skips GetFolders", func(t *testing.T) {
		sc := setupTestScenario(t)
		createPanels(t, sc, 3)

		trackingSvc := replaceWithTrackingFolderSvc(sc)

		result, err := sc.service.getAllLibraryElements(context.Background(), sc.reqContext.SignedInUser, model.SearchLibraryElementsQuery{
			PerPage:                100,
			Page:                   1,
			SkipFolderTreeForAdmin: true,
		})
		require.NoError(t, err)
		assert.Equal(t, 3, len(result.Elements))
		assert.Equal(t, 0, trackingSvc.GetCallCount(), "GetFolders should not be called for admin with SkipFolderTreeForAdmin")

		// FolderName should be empty since folder tree was not fetched
		for _, elem := range result.Elements {
			assert.Empty(t, elem.Meta.FolderName, "FolderName should be empty when SkipFolderTreeForAdmin is set")
		}
	})

	t.Run("admin without SkipFolderTreeForAdmin fetches folder tree", func(t *testing.T) {
		sc := setupTestScenario(t)
		createPanels(t, sc, 3)

		trackingSvc := replaceWithTrackingFolderSvc(sc)

		result, err := sc.service.getAllLibraryElements(context.Background(), sc.reqContext.SignedInUser, model.SearchLibraryElementsQuery{
			PerPage:                100,
			Page:                   1,
			SkipFolderTreeForAdmin: false,
		})
		require.NoError(t, err)
		assert.Equal(t, 3, len(result.Elements))
		assert.Equal(t, 1, trackingSvc.GetCallCount(), "GetFolders should be called once")

		for _, elem := range result.Elements {
			assert.Equal(t, sc.folder.Title, elem.Meta.FolderName, "FolderName should be populated")
		}
	})

	t.Run("non-admin with SkipFolderTreeForAdmin still fetches folder tree", func(t *testing.T) {
		sc := setupTestScenario(t)
		createPanels(t, sc, 3)

		trackingSvc := replaceWithTrackingFolderSvc(sc)

		viewer := &user.SignedInUser{
			UserID:  sc.user.UserID,
			UserUID: sc.user.UserUID,
			OrgID:   sc.user.OrgID,
			OrgRole: org.RoleViewer,
			Permissions: map[int64]map[string][]string{
				sc.user.OrgID: {
					folder.ActionFoldersRead: {folder.ScopeFoldersAll},
				},
			},
		}

		result, err := sc.service.getAllLibraryElements(context.Background(), viewer, model.SearchLibraryElementsQuery{
			PerPage:                100,
			Page:                   1,
			SkipFolderTreeForAdmin: true,
		})
		require.NoError(t, err)
		assert.Equal(t, 3, len(result.Elements))
		assert.Equal(t, 1, trackingSvc.GetCallCount(), "GetFolders should still be called for non-admin")
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
