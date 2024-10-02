package dashboards

import (
	"context"
	"errors"
	"strings"

	"github.com/grafana/grafana/pkg/infra/metrics"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"go.opentelemetry.io/otel"
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
	tracer                  = otel.Tracer("github.com/grafana/grafana/pkg/services/dashboards")
)

// NewFolderNameScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "folders:name:" into an uid based scope.
func NewFolderNameScopeResolver(folderDB folder.FolderStore, folderStore folder.Store) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeFoldersProvider.GetResourceScopeName("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		ctx, span := tracer.Start(ctx, "dashboards.NewFolderNameScopeResolver")
		span.End()

		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}
		nsName := scope[len(prefix):]
		if len(nsName) == 0 {
			return nil, ac.ErrInvalidScope
		}
		// this will fetch only root folders
		// this is legacy code so most probably it is not used
		folder, err := folderDB.GetFolderByTitle(ctx, orgID, nsName, nil)
		if err != nil {
			return nil, err
		}

		result, err := GetInheritedScopes(ctx, folder.OrgID, folder.UID, folderStore)
		if err != nil {
			return nil, err
		}

		result = append([]string{ScopeFoldersProvider.GetResourceScopeUID(folder.UID)}, result...)
		return result, nil
	})
}

// NewFolderIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "folders:id:" into an uid based scope.
func NewFolderIDScopeResolver(folderDB folder.FolderStore, folderStore folder.Store) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeFoldersProvider.GetResourceScope("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		ctx, span := tracer.Start(ctx, "dashboards.NewFolderIDScopeResolver")
		span.End()

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

		result, err := GetInheritedScopes(ctx, folder.OrgID, folder.UID, folderStore)
		if err != nil {
			return nil, err
		}

		result = append([]string{ScopeFoldersProvider.GetResourceScopeUID(folder.UID)}, result...)
		return result, nil
	})
}

// NewFolderUIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "folders:uid:"
// into uid based scopes for folder and its parents
func NewFolderUIDScopeResolver(folderStore folder.Store) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeFoldersProvider.GetResourceScopeUID("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		ctx, span := tracer.Start(ctx, "dashboards.NewFolderUIDScopeResolver")
		span.End()

		if !strings.HasPrefix(scope, prefix) {
			return nil, ac.ErrInvalidScope
		}

		uid, err := ac.ParseScopeUID(scope)
		if err != nil {
			return nil, err
		}

		inheritedScopes, err := GetInheritedScopes(ctx, orgID, uid, folderStore)
		if err != nil {
			return nil, err
		}
		return append(inheritedScopes, ScopeFoldersProvider.GetResourceScopeUID(uid)), nil
	})
}

// NewDashboardIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "dashboards:id:"
// into uid based scopes for both dashboard and folder
func NewDashboardIDScopeResolver(folderDB folder.FolderStore, ds DashboardService, folderStore folder.Store) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeDashboardsProvider.GetResourceScope("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		ctx, span := tracer.Start(ctx, "dashboards.NewDashboardIDScopeResolver")
		span.End()

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

		return resolveDashboardScope(ctx, folderDB, orgID, dashboard, folderStore)
	})
}

// NewDashboardUIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "dashboards:uid:"
// into uid based scopes for both dashboard and folder
func NewDashboardUIDScopeResolver(folderDB folder.FolderStore, ds DashboardService, folderStore folder.Store) (string, ac.ScopeAttributeResolver) {
	prefix := ScopeDashboardsProvider.GetResourceScopeUID("")
	return prefix, ac.ScopeAttributeResolverFunc(func(ctx context.Context, orgID int64, scope string) ([]string, error) {
		ctx, span := tracer.Start(ctx, "dashboards.NewDashboardUIDScopeResolver")
		span.End()

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

		return resolveDashboardScope(ctx, folderDB, orgID, dashboard, folderStore)
	})
}

func resolveDashboardScope(ctx context.Context, folderDB folder.FolderStore, orgID int64, dashboard *Dashboard, folderStore folder.Store) ([]string, error) {
	ctx, span := tracer.Start(ctx, "dashboards.resolveDashboardScope")
	span.End()

	var folderUID string
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
	// nolint:staticcheck
	if dashboard.FolderID < 0 {
		return []string{ScopeDashboardsProvider.GetResourceScopeUID(dashboard.UID)}, nil
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Dashboard).Inc()
	// nolint:staticcheck
	if dashboard.FolderID == 0 {
		folderUID = ac.GeneralFolderUID
	} else {
		folder, err := folderDB.GetFolderByID(ctx, orgID, dashboard.FolderID)
		if err != nil {
			return nil, err
		}
		folderUID = folder.UID
	}

	result, err := GetInheritedScopes(ctx, orgID, folderUID, folderStore)
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

func GetInheritedScopes(ctx context.Context, orgID int64, folderUID string, folderStore folder.Store) ([]string, error) {
	ctx, span := tracer.Start(ctx, "dashboards.GetInheritedScopes")
	span.End()

	if folderUID == ac.GeneralFolderUID {
		return nil, nil
	}

	var ancestors []*folder.Folder
	var err error
	if folderUID == folder.SharedWithMeFolderUID {
		ancestors = []*folder.Folder{&folder.SharedWithMeFolder}
	} else {
		ancestors, err = folderStore.GetParents(ctx, folder.GetParentsQuery{
			UID:   folderUID,
			OrgID: orgID,
		})
	}

	if err != nil {
		if errors.Is(err, folder.ErrFolderNotFound) {
			return nil, err
		}
		return nil, ac.ErrInternal.Errorf("could not retrieve folder parents: %w", err)
	}

	result := make([]string, 0, len(ancestors))
	for _, ff := range ancestors {
		result = append(result, ScopeFoldersProvider.GetResourceScopeUID(ff.UID))
	}

	return result, nil
}
