package libraryelements

import (
	"context"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/localcache"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
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

// panelFoldersKey is the context key carrying a request-scoped map of library
// panel UID -> folder UID.
type panelFoldersKey struct{}

// withPanelFolders returns a context carrying the folder UID of each given
// library element. The permission scope resolver uses this to skip re-querying
// the database for a panel's folder when the caller already has it (e.g. the
// list endpoint, which has just loaded the elements). The map is request-scoped,
// so it never goes stale and needs no invalidation.
func withPanelFolders(ctx context.Context, elements []model.LibraryElementDTO) context.Context {
	folders := make(map[string]string, len(elements))
	for _, e := range elements {
		folders[e.UID] = e.FolderUID
	}
	return context.WithValue(ctx, panelFoldersKey{}, folders)
}

// panelFolderFromContext returns the folder UID for a library panel UID if it
// was recorded by withPanelFolders for this request.
func panelFolderFromContext(ctx context.Context, panelUID string) (string, bool) {
	folders, ok := ctx.Value(panelFoldersKey{}).(map[string]string)
	if !ok {
		return "", false
	}
	folderUID, ok := folders[panelUID]
	return folderUID, ok
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
