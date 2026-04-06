package libraryelements

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/folder"
)

// cacheKey is the context key for knowing if it should use cache or not.
type cacheKey struct{}

// withCache returns a context with cache enabled.
func withCache(ctx context.Context) context.Context {
	return context.WithValue(ctx, cacheKey{}, true)
}

// hasCache returns if the context has cache enabled.
func hasCache(ctx context.Context) bool {
	_, ok := ctx.Value(cacheKey{}).(bool)
	return ok
}

// folderTreeCache provides caching for folder trees.
type folderTreeCache struct {
	cache     *localcache.CacheService
	folderSvc folder.Service
}

func newFolderTreeCache(folderSvc folder.Service) *folderTreeCache {
	return &folderTreeCache{
		cache:     localcache.New(30*time.Second, 1*time.Minute),
		folderSvc: folderSvc,
	}
}

// get returns a folder tree for the given user, using request-scoped caching.
// The tree is cached per (orgID, userUID).
func (c *folderTreeCache) get(ctx context.Context, user identity.Requester) (*folder.FolderTree, error) {
	cacheKey := fmt.Sprintf("folder_tree_%d_%s", user.GetOrgID(), user.GetUID())
	if cached, ok := c.cache.Get(cacheKey); ok {
		return cached.(*folder.FolderTree), nil
	}

	// Get folders accessible to this user
	folders, err := c.folderSvc.GetFolders(ctx, folder.GetFoldersQuery{
		OrgID:        user.GetOrgID(),
		SignedInUser: user,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list accessible folders: %w", err)
	}

	// Build tree from accessible folders
	tree := folder.NewFolderTree(folders)

	c.cache.Set(cacheKey, tree, 0)

	return tree, nil
}
