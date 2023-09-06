package libraryelements

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/infra/appcontext"
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

		user, err := appcontext.User(ctx)
		if err != nil {
			return nil, err
		}

		libElDTO, err := l.getLibraryElementByUid(ctx, user, model.GetLibraryElementCommand{
			UID:        uid,
			FolderName: dashboards.RootFolderName,
		})
		if err != nil {
			return nil, err
		}

		inheritedScopes, err := dashboards.GetInheritedScopes(ctx, orgID, libElDTO.FolderUID, folderSvc)
		if err != nil {
			return nil, err
		}
		return append(inheritedScopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(libElDTO.FolderUID), ScopeLibraryPanelsProvider.GetResourceScopeUID(uid)), nil
	})
}

// LibraryPanelNameScopeResolver provides a ScopeAttributeResolver that is able to convert a scope prefixed with "library.panels:name:" into a uid based scope.
func LibraryPanelNameScopeResolver(l *LibraryElementService, folderSvc folder.Service) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeLibraryPanelsProvider.GetResourceScopeName("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}

		nsName := scope[len(prefix):]
		if len(nsName) == 0 {
			return nil, ac.ErrInvalidScope
		}

		user, err := appcontext.User(ctx)
		if err != nil {
			return nil, err
		}

		elements, err := l.getLibraryElementsByName(ctx, user, nsName)
		if err != nil {
			return nil, err
		}
		if len(elements) == 0 {
			return nil, ErrNoElementsFound
		}
		if len(elements) > 1 {
			return nil, ErrElementNameNotUnique
		}

		el := elements[0]
		result, err := dashboards.GetInheritedScopes(ctx, el.OrgID, el.FolderUID, folderSvc)
		if err != nil {
			return nil, err
		}

		result = append([]string{ScopeLibraryPanelsProvider.GetResourceScopeUID(el.UID), dashboards.ScopeFoldersProvider.GetResourceScopeUID(el.FolderUID)}, result...)
		return result, nil
	})
}
