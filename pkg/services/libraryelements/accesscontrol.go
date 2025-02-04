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
