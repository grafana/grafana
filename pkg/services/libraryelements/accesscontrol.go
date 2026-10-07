package libraryelements

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
)

const (
	ScopeLibraryPanelsRoot   = "library.panels"
	ScopeLibraryPanelsPrefix = "library.panels:uid:"

	ActionLibraryPanelsCreate = "library.panels:create"
	ActionLibraryPanelsRead   = "library.panels:read"
	ActionLibraryPanelsWrite  = "library.panels:write"
	ActionLibraryPanelsDelete = "library.panels:delete"
)

var (
	ScopeLibraryPanelsProvider = ac.NewScopeProvider(ScopeLibraryPanelsRoot)

	ScopeLibraryPanelsAll = ScopeLibraryPanelsProvider.GetResourceAllScope()
)

var (
	ErrNoElementsFound      = errors.New("library element not found")
	ErrElementNameNotUnique = errors.New("several library elements with the same name were found")
)

// LibraryPanelUIDScopeResolver provides a ScopeAttributeResolver that is able to convert a scope prefixed with "library.panels:uid:"
// into uid based scopes for a library panel and its associated folder hierarchy
func LibraryPanelUIDScopeResolver(l *LibraryElementService, folderSvc folder.Service) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeLibraryPanelsProvider.GetResourceScopeUID("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}

		uid, err := ac.ParseScopeUID(scope)
		if err != nil {
			return nil, err
		}

		user, err := identity.GetRequester(ctx)
		if err != nil {
			return nil, err
		}

		// In case request cache ID is set, use cached tree
		var tree *folder.FolderTree
		if hasCache(ctx) {
			tree, err = l.treeCache.get(ctx, user)
			if err != nil {
				return nil, err
			}
		}

		// The caller (e.g. the list endpoint) may already know this panel's folder.
		// If so, use it and skip the per-panel database lookup; otherwise fetch it.
		folderUID, ok := panelFolderFromContext(ctx, uid)
		if !ok {
			libElDTO, err := l.getLibraryElementByUid(ctx, user, model.GetLibraryElementCommand{
				UID:        uid,
				FolderName: dashboards.RootFolderName,
			}, tree)
			if err != nil {
				return nil, err
			}
			folderUID = libElDTO.FolderUID
		} else if folderUID == "" {
			// The list endpoint represents the general folder as "", but the scope
			// machinery (and getLibraryElementByUid) uses the General folder UID.
			folderUID = ac.GeneralFolderUID
		}

		var inheritedScopes []string
		if tree != nil {
			inheritedScopes = getInheritedScopesFromTree(folderUID, tree)
		} else {
			inheritedScopes, err = folder.GetInheritedScopes(ctx, orgID, folderUID, folderSvc)
			if err != nil {
				return nil, err
			}
		}
		return append(inheritedScopes, folder.ScopeFoldersProvider.GetResourceScopeUID(folderUID), ScopeLibraryPanelsProvider.GetResourceScopeUID(uid)), nil
	})
}

// getInheritedScopesFromTree returns ancestor scopes using a pre-built folder tree.
func getInheritedScopesFromTree(folderUID string, tree *folder.FolderTree) []string {
	if folder.IsRootFolderUID(folderUID) {
		return nil
	}

	result := make([]string, 0)
	for ancestor := range tree.Ancestors(folderUID) {
		result = append(result, folder.ScopeFoldersProvider.GetResourceScopeUID(ancestor.UID))
	}
	return result
}
