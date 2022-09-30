package dashboards

import (
	"context"
	"strings"

	"github.com/grafana/grafana/pkg/models"
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

	ActionDashboardsCreate           = "dashboards:create"
	ActionDashboardsRead             = "dashboards:read"
	ActionDashboardsWrite            = "dashboards:write"
	ActionDashboardsDelete           = "dashboards:delete"
	ActionDashboardsPermissionsRead  = "dashboards.permissions:read"
	ActionDashboardsPermissionsWrite = "dashboards.permissions:write"
	ActionDashboardsPublicWrite      = "dashboards.public:write"
)

var (
	ScopeFoldersProvider    = ac.NewScopeProvider(ScopeFoldersRoot)
	ScopeFoldersAll         = ScopeFoldersProvider.GetResourceAllScope()
	ScopeDashboardsProvider = ac.NewScopeProvider(ScopeDashboardsRoot)
	ScopeDashboardsAll      = ScopeDashboardsProvider.GetResourceAllScope()
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

		id, err := ac.ParseScopeID(scope)
		if err != nil {
			return nil, err
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

// NewDashboardIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "dashboards:id:"
// into uid based scopes for both dashboard and folder
func NewDashboardIDScopeResolver(db Store) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeDashboardsProvider.GetResourceScope("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}

		id, err := ac.ParseScopeID(scope)
		if err != nil {
			return nil, err
		}

		dashboard, err := db.GetDashboard(ctx, &models.GetDashboardQuery{Id: id, OrgId: orgID})
		if err != nil {
			return nil, err
		}

		return resolveDashboardScope(ctx, db, orgID, dashboard)
	})
}

// NewDashboardUIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "dashboards:uid:"
// into uid based scopes for both dashboard and folder
func NewDashboardUIDScopeResolver(db Store) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeDashboardsProvider.GetResourceScopeUID("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}

		uid, err := ac.ParseScopeUID(scope)
		if err != nil {
			return nil, err
		}

		dashboard, err := db.GetDashboard(ctx, &models.GetDashboardQuery{Uid: uid, OrgId: orgID})
		if err != nil {
			return nil, err
		}

		return resolveDashboardScope(ctx, db, orgID, dashboard)
	})
}

func resolveDashboardScope(ctx context.Context, db Store, orgID int64, dashboard *models.Dashboard) ([]string, error) {
	var folderUID string
	if dashboard.FolderId < 0 {
		return []string{ScopeDashboardsProvider.GetResourceScopeUID(dashboard.Uid)}, nil
	}

	if dashboard.FolderId == 0 {
		folderUID = ac.GeneralFolderUID
	} else {
		folder, err := db.GetFolderByID(ctx, orgID, dashboard.FolderId)
		if err != nil {
			return nil, err
		}
		folderUID = folder.Uid
	}

	return []string{
		ScopeDashboardsProvider.GetResourceScopeUID(dashboard.Uid),
		ScopeFoldersProvider.GetResourceScopeUID(folderUID),
	}, nil
}
