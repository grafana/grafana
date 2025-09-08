package dashboards

import (
	"context"
	"errors"
	"strings"

	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
	ActionSnapshotsCreate            = "snapshots:create"
	ActionSnapshotsDelete            = "snapshots:delete"
	ActionSnapshotsRead              = "snapshots:read"
)

var (
	ScopeFoldersProvider    = ac.NewScopeProvider(ScopeFoldersRoot)
	ScopeFoldersAll         = ScopeFoldersProvider.GetResourceAllScope()
	ScopeDashboardsProvider = ac.NewScopeProvider(ScopeDashboardsRoot)
	ScopeDashboardsAll      = ScopeDashboardsProvider.GetResourceAllScope()
	tracer                  = otel.Tracer("github.com/grafana/grafana/pkg/services/dashboards")
)

type UIDLookup = func(ctx context.Context, orgID int64, id int64) (string, error)

// NewFolderIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "folders:id:" into an uid based scope.
func NewFolderIDScopeResolver(lookup UIDLookup, folderSvc folder.APIServerService) (string, ac.ScopeAttributeResolver) {
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

		return identity.WithServiceIdentityFn(ctx, orgID, func(ctx context.Context) ([]string, error) {
			uid, err := lookup(ctx, orgID, id)
			if err != nil {
				return nil, err
			}

			result, err := GetInheritedScopes(ctx, orgID, uid, folderSvc)
			if err != nil {
				return nil, err
			}

			return append([]string{ScopeFoldersProvider.GetResourceScopeUID(uid)}, result...), nil
		})
	})
}

// NewFolderUIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "folders:uid:"
// into uid based scopes for folder and its parents
func NewFolderUIDScopeResolver(folderSvc folder.Service) (string, ac.ScopeAttributeResolver) {
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

		return identity.WithServiceIdentityFn(ctx, orgID, func(ctx context.Context) ([]string, error) {
			inheritedScopes, err := GetInheritedScopes(ctx, orgID, uid, folderSvc)
			if err != nil {
				return nil, err
			}
			return append(inheritedScopes, ScopeFoldersProvider.GetResourceScopeUID(uid)), nil
		})
	})
}

// NewDashboardIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "dashboards:id:"
// into uid based scopes for both dashboard and folder
func NewDashboardIDScopeResolver(ds DashboardService, folderSvc folder.Service) (string, ac.ScopeAttributeResolver) {
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

		return identity.WithServiceIdentityFn(ctx, orgID, func(ctx context.Context) ([]string, error) {
			dashboard, err := ds.GetDashboard(ctx, &GetDashboardQuery{ID: id, OrgID: orgID})
			if err != nil {
				return nil, err
			}

			return resolveDashboardScope(ctx, orgID, dashboard, folderSvc)
		})
	})
}

// NewDashboardUIDScopeResolver provides an ScopeAttributeResolver that is able to convert a scope prefixed with "dashboards:uid:"
// into uid based scopes for both dashboard and folder
func NewDashboardUIDScopeResolver(ds DashboardService, folderSvc folder.Service) (string, ac.ScopeAttributeResolver) {
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

		return identity.WithServiceIdentityFn(ctx, orgID, func(ctx context.Context) ([]string, error) {
			dashboard, err := ds.GetDashboard(ctx, &GetDashboardQuery{UID: uid, OrgID: orgID})
			if err != nil {
				return nil, err
			}

			return resolveDashboardScope(ctx, orgID, dashboard, folderSvc)
		})
	})
}

func resolveDashboardScope(ctx context.Context, orgID int64, dashboard *Dashboard, folderSvc folder.Service) ([]string, error) {
	ctx, span := tracer.Start(ctx, "dashboards.resolveDashboardScope")
	span.End()

	var folderUID string
	if dashboard.FolderUID == "" {
		folderUID = ac.GeneralFolderUID
	} else {
		folderUID = dashboard.FolderUID
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

func GetInheritedScopes(ctx context.Context, orgID int64, folderUID string, folderSvc folder.APIServerService) ([]string, error) {
	ctx, span := tracer.Start(ctx, "dashboards.GetInheritedScopes")
	span.End()

	if folderUID == ac.GeneralFolderUID {
		return nil, nil
	}
	ancestors, err := folderSvc.GetParents(ctx, folder.GetParentsQuery{
		UID:   folderUID,
		OrgID: orgID,
	})

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
