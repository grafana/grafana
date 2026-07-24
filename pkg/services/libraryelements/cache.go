package libraryelements

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
)

// cacheKey is the context key carrying the request-scoped folder tree holder.
type cacheKey struct{}

// treeHolder memoizes a user's folder tree for the lifetime of a single request.
// A request only ever serves one requester, so a single holder is enough. Because
// it lives only as long as the request context, it can never go stale across
// requests and needs no invalidation when folders are created, renamed or moved.
// The orgID/uid it was built for are recorded so a tree is never reused for a
// different user sharing the same context.
type treeHolder struct {
	orgID int64
	uid   string
	tree  *folder.FolderTree
	err   error
	done  bool
}

// withCache returns a context that memoizes the folder tree for the current request.
func withCache(ctx context.Context) context.Context {
	return context.WithValue(ctx, cacheKey{}, &treeHolder{})
}

// hasCache returns if the context has request-scoped folder tree caching enabled.
func hasCache(ctx context.Context) bool {
	_, ok := ctx.Value(cacheKey{}).(*treeHolder)
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

// folderTreeCache builds folder trees, memoizing the result within a single
// request when the context carries a treeHolder (see withCache).
type folderTreeCache struct {
	folderSvc folder.Service
}

func newFolderTreeCache(folderSvc folder.Service) *folderTreeCache {
	return &folderTreeCache{
		folderSvc: folderSvc,
	}
}

// get returns the folder tree accessible to the given user. When the request
// context memoizes trees (withCache), the tree is built once and reused for the
// rest of the request; the list endpoint asks for it once to build the response
// and then once per panel in the permission scope resolver, so this collapses
// those N+1 lookups into a single GetFolders call. Without a holder, each call
// builds a fresh tree.
func (c *folderTreeCache) get(ctx context.Context, user identity.Requester) (*folder.FolderTree, error) {
	orgID, uid := user.GetOrgID(), user.GetUID()
	holder, _ := ctx.Value(cacheKey{}).(*treeHolder)
	if holder != nil && holder.done && holder.orgID == orgID && holder.uid == uid {
		return holder.tree, holder.err
	}

	// Get folders accessible to this user
	folders, err := c.folderSvc.GetFolders(ctx, folder.GetFoldersQuery{
		OrgID:        orgID,
		SignedInUser: user,
	})
	if err != nil {
		err = fmt.Errorf("failed to list accessible folders: %w", err)
		if holder != nil {
			holder.orgID, holder.uid, holder.err, holder.done = orgID, uid, err, true
		}
		return nil, err
	}

	// Build tree from accessible folders
	tree := folder.NewFolderTree(folders)
	if holder != nil {
		holder.orgID, holder.uid, holder.tree, holder.done = orgID, uid, tree, true
	}

	return tree, nil
}
