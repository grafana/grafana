package dashboards

import (
	"context"
	"strings"

	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
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
func NewFolderNameScopeResolver(folderDB folder.FolderStore, folderSvc folder.Service) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeFoldersProvider.GetResourceScopeName("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}
		nsName := scope[len(prefix):]
		if len(nsName) == 0 {
			return nil, ac.ErrInvalidScope
		}
		folder, err := folderDB.GetFolderByTitle(ctx, orgID, nsName)
		if err != nil {
			return nil, err
		}

		result, err := GetInheritedScopes(ctx, folder.OrgID, folder.UID, folderSvc)
		if err != nil {
			return nil, err
		}

		result = append([]string{ScopeFoldersProvider.GetResourceScopeUID(folder.UID)}, result...)
		return result, nil
	})
}

// NewFolderIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "folders:id:" into an uid based scope.
func NewFolderIDScopeResolver(folderDB folder.FolderStore, folderSvc folder.Service) (string, ac.ScopeAttributeResolver) {
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

		folder, err := folderDB.GetFolderByID(ctx, orgID, id)
		if err != nil {
			return nil, err
		}

		result, err := GetInheritedScopes(ctx, folder.OrgID, folder.UID, folderSvc)
		if err != nil {
			return nil, err
		}

		result = append([]string{ScopeFoldersProvider.GetResourceScopeUID(folder.UID)}, result...)
		return result, nil
	})
}

// NewFolderUIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "folders:uid:"
// into uid based scopes for folder and its parents
func NewFolderUIDScopeResolver(folderSvc folder.Service) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeFoldersProvider.GetResourceScopeUID("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}

		uid, err := ac.ParseScopeUID(scope)
		if err != nil {
			return nil, err
		}

		inheritedScopes, err := GetInheritedScopes(ctx, orgID, uid, folderSvc)
		if err != nil {
			return nil, err
		}
		return append(inheritedScopes, ScopeFoldersProvider.GetResourceScopeUID(uid)), nil
	})
}

// NewDashboardIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "dashboards:id:"
// into uid based scopes for both dashboard and folder
func NewDashboardIDScopeResolver(folderDB folder.FolderStore, ds DashboardService, folderSvc folder.Service) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeDashboardsProvider.GetResourceScope("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}

		id, err := ac.ParseScopeID(scope)
		if err != nil {
			return nil, err
		}

		dashboard, err := ds.GetDashboard(ctx, &GetDashboardQuery{ID: id, OrgID: orgID})
		if err != nil {
			return nil, err
		}

		return resolveDashboardScope(ctx, folderDB, orgID, dashboard, folderSvc)
	})
}

// NewDashboardUIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "dashboards:uid:"
// into uid based scopes for both dashboard and folder
func NewDashboardUIDScopeResolver(folderDB folder.FolderStore, ds DashboardService, folderSvc folder.Service) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeDashboardsProvider.GetResourceScopeUID("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}

		uid, err := ac.ParseScopeUID(scope)
		if err != nil {
			return nil, err
		}

		dashboard, err := ds.GetDashboard(ctx, &GetDashboardQuery{UID: uid, OrgID: orgID})
		if err != nil {
			return nil, err
		}

		return resolveDashboardScope(ctx, folderDB, orgID, dashboard, folderSvc)
	})
}

func resolveDashboardScope(ctx context.Context, folderDB folder.FolderStore, orgID int64, dashboard *Dashboard, folderSvc folder.Service) ([]string, error) {
	var folderUID string
	if dashboard.FolderID < 0 {
		return []string{ScopeDashboardsProvider.GetResourceScopeUID(dashboard.UID)}, nil
	}

	if dashboard.FolderID == 0 {
		folderUID = ac.GeneralFolderUID
	} else {
		folder, err := folderDB.GetFolderByID(ctx, orgID, dashboard.FolderID)
		if err != nil {
			return nil, err
		}
		folderUID = folder.UID
	}

	result, err := GetInheritedScopes(ctx, orgID, folderUID, folderSvc)
	if err != nil {
		return nil, err
	}

	result = append([]string{
		ScopeDashboardsProvider.GetResourceScopeUID(dashboard.UID),
		ScopeFoldersProvider.GetResourceScopeUID(folderUID),
	},
		result...,
	)

	return result, nil
}

func GetInheritedScopes(ctx context.Context, orgID int64, folderUID string, folderSvc folder.Service) ([]string, error) {
	ancestors, err := folderSvc.GetParents(ctx, folder.GetParentsQuery{
		UID:   folderUID,
		OrgID: orgID,
	})

	if err != nil {
		return nil, ac.ErrInternal.Errorf("could not retrieve folder parents: %w", err)
	}

	result := make([]string, 0, len(ancestors))
	for _, ff := range ancestors {
		result = append(result, ScopeFoldersProvider.GetResourceScopeUID(ff.UID))
	}

	return result, nil
}
