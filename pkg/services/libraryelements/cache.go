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
	// useSearch builds the tree from the search index (lightweight UID+parent
	// refs) instead of a full folder object list, avoiding the paged object-list
	// round-trips that dominate large instances. Feature-flag controlled.
	useSearch bool
}

func newFolderTreeCache(folderSvc folder.Service, useSearch bool) *folderTreeCache {
	return &folderTreeCache{
		cache:     localcache.New(30*time.Second, 1*time.Minute),
		folderSvc: folderSvc,
		useSearch: useSearch,
	}
}

// get returns a folder tree for the given user, using request-scoped caching.
// The tree is cached per (orgID, userUID).
func (c *folderTreeCache) get(ctx context.Context, user identity.Requester) (*folder.FolderTree, error) {
	cacheKey := fmt.Sprintf("folder_tree_%d_%s", user.GetOrgID(), user.GetUID())
	if cached, ok := c.cache.Get(cacheKey); ok {
		return cached.(*folder.FolderTree), nil
	}

	folders, err := c.listFolders(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("failed to list accessible folders: %w", err)
	}

	// Build tree from accessible folders
	tree := folder.NewFolderTree(folders)

	c.cache.Set(cacheKey, tree, 0)

	return tree, nil
}

// listFolders returns the folders accessible to the user. When useSearch is set
// it queries the search index (lightweight refs), otherwise it lists full folder
// objects. Both paths return the data NewFolderTree needs (ID, UID, parent, title).
//
// If the requester has no ID token, fall back to GetFolders. SearchFolders scopes
// hits server-side via the ID token; without one, unified search classifies the
// call as a service call and returns every folder in the org, which would leak
// library elements from folders the user can't read.
func (c *folderTreeCache) listFolders(ctx context.Context, user identity.Requester) ([]*folder.Folder, error) {
	if !c.useSearch || user.GetIDToken() == "" {
		return c.folderSvc.GetFolders(ctx, folder.GetFoldersQuery{
			OrgID:        user.GetOrgID(),
			SignedInUser: user,
		})
	}

	// Unlike GetFolders, folderimpl.SearchFolders authorizes off the requester in
	// the context (not the query), so install it — callers may pass a bare context
	// with the identity supplied only via SignedInUser (e.g. async snapshot builds).
	ctx = identity.WithRequester(ctx, user)
	hits, err := c.folderSvc.SearchFolders(ctx, folder.SearchFoldersQuery{
		OrgID:        user.GetOrgID(),
		SignedInUser: user,
	})
	if err != nil {
		return nil, err
	}
	folders := make([]*folder.Folder, 0, len(hits))
	for _, hit := range hits {
		folders = append(folders, &folder.Folder{
			ID:        hit.ID, // nolint:staticcheck
			UID:       hit.UID,
			Title:     hit.Title,
			ParentUID: hit.FolderUID,
			OrgID:     user.GetOrgID(),
		})
	}
	return folders, nil
}
