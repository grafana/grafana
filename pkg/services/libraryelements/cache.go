package libraryelements

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/folder"
)

// requestCacheKey is the context key for the request ID used for request-scoped caching.
type requestCacheKey struct{}

// withRequestCacheID returns a context with a request cache ID.
func withRequestCacheID(ctx context.Context, requestCacheID string) context.Context {
	return context.WithValue(ctx, requestCacheKey{}, requestCacheID)
}

// getRequestCacheID returns the request cache ID from the context.
func getRequestCacheID(ctx context.Context) string {
	if id, ok := ctx.Value(requestCacheKey{}).(string); ok {
		return id
	}
	return ""
}

// folderTreeCache provides request-scoped caching for folder trees.
type folderTreeCache struct {
	cache     *localcache.CacheService
	folderSvc folder.Service
	cacheTTL  time.Duration
}

func newFolderTreeCache(folderSvc folder.Service) *folderTreeCache {
	return &folderTreeCache{
		cache:     localcache.New(30*time.Second, 1*time.Minute),
		folderSvc: folderSvc,
		cacheTTL:  30 * time.Second,
	}
}

// get returns a folder tree for the given user, using request-scoped caching.
// The tree is cached per (orgID, userUID, requestID).
func (c *folderTreeCache) get(ctx context.Context, user identity.Requester) (*folder.FolderTree, error) {
	requestID := getRequestCacheID(ctx)
	cacheKey := fmt.Sprintf("folder_tree_%d_%s_%s", user.GetOrgID(), user.GetUID(), requestID)

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

	// Only cache if we have a request ID (request-scoped caching)
	if requestID != "" {
		c.cache.Set(cacheKey, tree, c.cacheTTL)
	}

	return tree, nil
}
