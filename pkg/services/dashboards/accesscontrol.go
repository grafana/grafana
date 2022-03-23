package dashboards

import (
	"context"
	"strconv"
	"strings"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

const (
	ActionFoldersCreate           = "folders:create"
	ActionFoldersRead             = "folders:read"
	ActionFoldersWrite            = "folders:write"
	ActionFoldersDelete           = "folders:delete"
	ActionFoldersPermissionsRead  = "folders.permissions:read"
	ActionFoldersPermissionsWrite = "folders.permissions:write"

	ScopeFoldersRoot = "folders"
)

var (
	ScopeFoldersAll      = ac.GetResourceAllScope(ScopeFoldersRoot)
	ScopeFoldersProvider = ac.NewScopeProvider(ScopeFoldersRoot)
)

// NewNameScopeResolver provides an AttributeScopeResolver that is able to convert a scope prefixed with "folders:name:" into an id based scope.
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
		return ScopeFoldersProvider.GetResourceScope(strconv.FormatInt(folder.Id, 10)), nil
	}
	return prefix, resolver
}

// NewUidScopeResolver provides an AttributeScopeResolver that is able to convert a scope prefixed with "folders:uid:" into an id based scope.
func NewUidScopeResolver(db Store) (string, ac.AttributeScopeResolveFunc) {
	prefix := ScopeFoldersProvider.GetResourceScopeUID("")
	resolver := func(ctx context.Context, orgID int64, scope string) (string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return "", ac.ErrInvalidScope
		}
		uid := scope[len(prefix):]
		if len(uid) == 0 {
			return "", ac.ErrInvalidScope
		}
		folder, err := db.GetFolderByUID(ctx, orgID, uid)
		if err != nil {
			return "", err
		}
		return ScopeFoldersProvider.GetResourceScope(strconv.FormatInt(folder.Id, 10)), nil
	}
	return prefix, resolver
}
