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

	ActionDashboardsCreate        = "dashboards:create"
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

// NewNameScopeResolver provides an AttributeScopeResolver that is able to convert a scope prefixed with "folders:name:" into an uid based scope.
func NewNameScopeResolver(db Store) (string, ac.AttributeScopeResolveFunc) {
	prefix := ScopeFoldersProvider.GetResourceScopeName("")
	resolver := func(ctx context.Context, orgID int64, scope string) (string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return "", ac.ErrInvalidScope
		}
		nsName := scope[len(prefix):]
		if len(nsName) == 0 {
			return "", ac.ErrInvalidScope
		}
		folder, err := db.GetFolderByTitle(ctx, orgID, nsName)
		if err != nil {
			return "", err
		}
		return ScopeFoldersProvider.GetResourceScopeUID(folder.Uid), nil
	}
	return prefix, resolver
}

// NewIDScopeResolver provides an AttributeScopeResolver that is able to convert a scope prefixed with "folders:id:" into an uid based scope.
func NewIDScopeResolver(db Store) (string, ac.AttributeScopeResolveFunc) {
	prefix := ScopeFoldersProvider.GetResourceScope("")
	resolver := func(ctx context.Context, orgID int64, scope string) (string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return "", ac.ErrInvalidScope
		}

		id, err := strconv.ParseInt(scope[len(prefix):], 10, 64)
		if err != nil {
			return "", ac.ErrInvalidScope
		}

		if id == 0 {
			return ScopeFoldersProvider.GetResourceScopeUID(ac.GeneralFolderUID), nil
		}

		folder, err := db.GetFolderByID(ctx, orgID, id)
		if err != nil {
			return "", err
		}

		return ScopeFoldersProvider.GetResourceScopeUID(folder.Uid), nil
	}
	return prefix, resolver
}
