package dashboards

import (
	"context"
	"strconv"
	"strings"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	ScopeFoldersRoot   = "folders"
	ScopeFoldersPrefix = "folders:uid:"

	ActionFoldersCreate           = "folders:create"
	ActionFoldersRead             = "folders:read"
	ActionFoldersWrite            = "folders:write"
	ActionFoldersDelete           = "folders:delete"
	ActionFoldersPermissionsRead  = "folders.permissions:read"
	ActionFoldersPermissionsWrite = "folders.permissions:write"

	ScopeDashboardsRoot   = "dashboards"
	ScopeDashboardsPrefix = "dashboards:uid:"
)

var (
	ScopeFoldersAll      = ac.GetResourceAllScope(ScopeFoldersRoot)
	ScopeFoldersProvider = ac.NewScopeProvider(ScopeFoldersRoot)
)

// NewFolderNameScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "folders:name:" into an uid based scope.
func NewFolderNameScopeResolver(db Store) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeFoldersProvider.GetResourceScopeName("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}
		nsName := scope[len(prefix):]
		if len(nsName) == 0 {
			return nil, ac.ErrInvalidScope
		}
		folder, err := db.GetFolderByTitle(ctx, orgID, nsName)
		if err != nil {
			return nil, err
		}
		return []string{ScopeFoldersProvider.GetResourceScopeUID(folder.Uid)}, nil
	})
}

// NewFolderIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "folders:id:" into an uid based scope.
func NewFolderIDScopeResolver(db Store) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeFoldersProvider.GetResourceScope("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}

		id, err := strconv.ParseInt(scope[len(prefix):], 10, 64)
		if err != nil {
			return nil, ac.ErrInvalidScope
		}

		if id == 0 {
			return []string{ScopeFoldersProvider.GetResourceScopeUID(ac.GeneralFolderUID)}, nil
		}

		folder, err := db.GetFolderByID(ctx, orgID, id)
		if err != nil {
			return nil, err
		}

		return []string{ScopeFoldersProvider.GetResourceScopeUID(folder.Uid)}, nil
	})
}
