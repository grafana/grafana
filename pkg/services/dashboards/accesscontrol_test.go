package dashboards

import (
	"context"
	"math/rand"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
)

func TestNewFolderIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewFolderIDScopeResolver(foldertest.NewFakeFolderStore(t), foldertest.NewFakeService())
		require.Equal(t, "folders:id:", prefix)
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := NewFolderIDScopeResolver(foldertest.NewFakeFolderStore(t), foldertest.NewFakeService())

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:uid:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})

	t.Run("resolver should convert id 0 to general uid scope", func(t *testing.T) {
		var (
			orgId       = rand.Int63()
			scope       = "folders:id:0"
			_, resolver = NewFolderIDScopeResolver(foldertest.NewFakeFolderStore(t), foldertest.NewFakeService())
		)

		resolved, err := resolver.Resolve(context.Background(), orgId, scope)
		require.NoError(t, err)

		require.Len(t, resolved, 1)
		require.Equal(t, "folders:uid:general", resolved[0])
	})

	t.Run("resolver should fail if resource of input scope is empty", func(t *testing.T) {
		_, resolver := NewFolderIDScopeResolver(foldertest.NewFakeFolderStore(t), foldertest.NewFakeService())

		_, err := resolver.Resolve(context.Background(), rand.Int63(), "folders:id:")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
	t.Run("returns 'not found' if folder does not exist", func(t *testing.T) {
		folderStore := foldertest.NewFakeFolderStore(t)
		folderStore.On("GetFolderByID", mock.Anything, mock.Anything, mock.Anything).Return(nil, ErrDashboardNotFound).Once()
		_, resolver := NewFolderIDScopeResolver(folderStore, foldertest.NewFakeService())

		orgId := rand.Int63()
		scope := "folders:id:10"
		resolvedScopes, err := resolver.Resolve(context.Background(), orgId, scope)
		require.ErrorIs(t, err, ErrDashboardNotFound)
		require.Nil(t, resolvedScopes)
	})
}

func TestNewDashboardIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewDashboardIDScopeResolver(&FakeDashboardService{}, foldertest.NewFakeService())
		require.Equal(t, "dashboards:id:", prefix)
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := NewDashboardIDScopeResolver(&FakeDashboardService{}, foldertest.NewFakeService())
		_, err := resolver.Resolve(context.Background(), rand.Int63(), "dashboards:uid:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
}

func TestNewDashboardUIDScopeResolver(t *testing.T) {
	t.Run("prefix should be expected", func(t *testing.T) {
		prefix, _ := NewDashboardUIDScopeResolver(&FakeDashboardService{}, foldertest.NewFakeService())
		require.Equal(t, "dashboards:uid:", prefix)
	})

	t.Run("resolver should fail if input scope is not expected", func(t *testing.T) {
		_, resolver := NewDashboardUIDScopeResolver(&FakeDashboardService{}, foldertest.NewFakeService())
		_, err := resolver.Resolve(context.Background(), rand.Int63(), "dashboards:id:123")
		require.ErrorIs(t, err, ac.ErrInvalidScope)
	})
}

func TestAncestorsCache(t *testing.T) {
	t.Run("GetAncestorsCache returns nil when cache not in context", func(t *testing.T) {
		ctx := context.Background()
		cache := GetAncestorsCache(ctx)
		require.Nil(t, cache)
	})

	t.Run("WithAncestorsCache creates a cache that can be retrieved", func(t *testing.T) {
		ctx := context.Background()
		ctxWithCache := WithAncestorsCache(ctx)

		cache := GetAncestorsCache(ctxWithCache)
		require.NotNil(t, cache)
		require.Empty(t, cache)
	})

	t.Run("cache is mutable and changes persist", func(t *testing.T) {
		ctx := WithAncestorsCache(context.Background())

		cache := GetAncestorsCache(ctx)
		require.NotNil(t, cache)

		// Add entry to cache
		cache["1:folder1"] = []string{"folders:uid:parent1", "folders:uid:parent2"}

		// Retrieve again and verify entry exists
		cache2 := GetAncestorsCache(ctx)
		require.NotNil(t, cache2)
		require.Contains(t, cache2, "1:folder1")
		require.Equal(t, []string{"folders:uid:parent1", "folders:uid:parent2"}, cache2["1:folder1"])
	})
}

func TestGetInheritedScopes(t *testing.T) {
	t.Run("returns nil for general folder", func(t *testing.T) {
		ctx := context.Background()
		folderSvc := foldertest.NewFakeService()

		scopes, err := GetInheritedScopes(ctx, 1, ac.GeneralFolderUID, folderSvc)
		require.NoError(t, err)
		require.Nil(t, scopes)
	})

	t.Run("returns scopes from folder parents", func(t *testing.T) {
		ctx := context.Background()
		folderSvc := foldertest.NewFakeService()
		folderSvc.ExpectedFolders = []*folder.Folder{
			{UID: "parent1", OrgID: 1},
			{UID: "parent2", OrgID: 1},
		}

		scopes, err := GetInheritedScopes(ctx, 1, "child-folder", folderSvc)
		require.NoError(t, err)
		require.Len(t, scopes, 2)
		assert.Equal(t, "folders:uid:parent1", scopes[0])
		assert.Equal(t, "folders:uid:parent2", scopes[1])
	})

	t.Run("uses cache on second call (cache hit)", func(t *testing.T) {
		ctx := WithAncestorsCache(context.Background())
		folderSvc := foldertest.NewFakeService()
		folderSvc.ExpectedFolders = []*folder.Folder{
			{UID: "parent1", OrgID: 1},
		}

		// First call should query folder service
		scopes1, err := GetInheritedScopes(ctx, 1, "child-folder", folderSvc)
		require.NoError(t, err)
		require.Len(t, scopes1, 1)
		assert.Equal(t, "folders:uid:parent1", scopes1[0])

		// Verify entry is in cache
		cache := GetAncestorsCache(ctx)
		require.NotNil(t, cache)
		require.Contains(t, cache, "1:child-folder")

		// Clear expected folders - if cache works, we won't need to call folder service again
		folderSvc.ExpectedFolders = nil

		// Second call should use cache
		scopes2, err := GetInheritedScopes(ctx, 1, "child-folder", folderSvc)
		require.NoError(t, err)
		require.Equal(t, scopes1, scopes2)
	})

	t.Run("different orgs have different cache entries", func(t *testing.T) {
		ctx := WithAncestorsCache(context.Background())
		folderSvc := foldertest.NewFakeService()

		// Pre-populate cache with entries for different orgs
		cache := GetAncestorsCache(ctx)
		cache["1:folder-a"] = []string{"folders:uid:org1-parent"}
		cache["2:folder-a"] = []string{"folders:uid:org2-parent"}

		// Query for org 1
		scopes1, err := GetInheritedScopes(ctx, 1, "folder-a", folderSvc)
		require.NoError(t, err)
		require.Equal(t, []string{"folders:uid:org1-parent"}, scopes1)

		// Query for org 2
		scopes2, err := GetInheritedScopes(ctx, 2, "folder-a", folderSvc)
		require.NoError(t, err)
		require.Equal(t, []string{"folders:uid:org2-parent"}, scopes2)
	})

	t.Run("cache stores empty slice for folders with no parents", func(t *testing.T) {
		ctx := WithAncestorsCache(context.Background())
		folderSvc := foldertest.NewFakeService()
		// Empty ExpectedFolders means folder has no parents
		folderSvc.ExpectedFolders = []*folder.Folder{}

		scopes, err := GetInheritedScopes(ctx, 1, "root-folder", folderSvc)
		require.NoError(t, err)
		require.Empty(t, scopes)

		// Verify empty result is cached
		cache := GetAncestorsCache(ctx)
		require.NotNil(t, cache)
		require.Contains(t, cache, "1:root-folder")
		require.Empty(t, cache["1:root-folder"])
	})

	t.Run("without cache context, does not fail", func(t *testing.T) {
		ctx := context.Background() // No cache
		folderSvc := foldertest.NewFakeService()
		folderSvc.ExpectedFolders = []*folder.Folder{
			{UID: "parent1", OrgID: 1},
		}

		scopes, err := GetInheritedScopes(ctx, 1, "child-folder", folderSvc)
		require.NoError(t, err)
		require.Len(t, scopes, 1)
		assert.Equal(t, "folders:uid:parent1", scopes[0])
	})

	t.Run("returns error when folder not found", func(t *testing.T) {
		ctx := WithAncestorsCache(context.Background())
		folderSvc := foldertest.NewFakeService()
		folderSvc.ExpectedError = folder.ErrFolderNotFound

		scopes, err := GetInheritedScopes(ctx, 1, "nonexistent-folder", folderSvc)
		require.ErrorIs(t, err, folder.ErrFolderNotFound)
		require.Nil(t, scopes)

		// Verify error case is NOT cached
		cache := GetAncestorsCache(ctx)
		require.NotContains(t, cache, "1:nonexistent-folder")
	})

	t.Run("caches ancestors for all intermediate folders in hierarchy", func(t *testing.T) {
		ctx := WithAncestorsCache(context.Background())
		folderSvc := foldertest.NewFakeService()
		// Simulate hierarchy: grandparent -> parent -> child
		// GetParents returns [parent, grandparent] for child
		folderSvc.ExpectedFolders = []*folder.Folder{
			{UID: "parent", OrgID: 1},
			{UID: "grandparent", OrgID: 1},
		}

		// Query for child folder
		scopes, err := GetInheritedScopes(ctx, 1, "child", folderSvc)
		require.NoError(t, err)
		require.Len(t, scopes, 2)
		assert.Equal(t, "folders:uid:parent", scopes[0])
		assert.Equal(t, "folders:uid:grandparent", scopes[1])

		// Verify cache is populated for all folders in the hierarchy
		cache := GetAncestorsCache(ctx)
		require.NotNil(t, cache)

		// child's ancestors
		require.Contains(t, cache, "1:child")
		assert.Equal(t, []string{"folders:uid:parent", "folders:uid:grandparent"}, cache["1:child"])

		// parent's ancestors (grandparent only)
		require.Contains(t, cache, "1:parent")
		assert.Equal(t, []string{"folders:uid:grandparent"}, cache["1:parent"])

		// grandparent's ancestors (empty - it's at root)
		require.Contains(t, cache, "1:grandparent")
		assert.Empty(t, cache["1:grandparent"])

		// Clear folder service expectations - subsequent calls should use cache only
		folderSvc.ExpectedFolders = nil
		folderSvc.ExpectedError = folder.ErrFolderNotFound // Would fail if called

		// Query for parent - should use cache
		parentScopes, err := GetInheritedScopes(ctx, 1, "parent", folderSvc)
		require.NoError(t, err)
		assert.Equal(t, []string{"folders:uid:grandparent"}, parentScopes)

		// Query for grandparent - should use cache
		grandparentScopes, err := GetInheritedScopes(ctx, 1, "grandparent", folderSvc)
		require.NoError(t, err)
		assert.Empty(t, grandparentScopes)
	})

	t.Run("does not overwrite existing cache entries for intermediate folders", func(t *testing.T) {
		ctx := WithAncestorsCache(context.Background())

		// Pre-populate cache with a different value for parent
		cache := GetAncestorsCache(ctx)
		cache["1:parent"] = []string{"folders:uid:custom-ancestor"}

		folderSvc := foldertest.NewFakeService()
		folderSvc.ExpectedFolders = []*folder.Folder{
			{UID: "parent", OrgID: 1},
			{UID: "grandparent", OrgID: 1},
		}

		// Query for child
		_, err := GetInheritedScopes(ctx, 1, "child", folderSvc)
		require.NoError(t, err)

		// Verify parent's cache entry was NOT overwritten
		assert.Equal(t, []string{"folders:uid:custom-ancestor"}, cache["1:parent"])

		// But grandparent should be populated since it wasn't in cache
		assert.Empty(t, cache["1:grandparent"])
	})
}
