package dashboards

import (
	"context"
	"strings"

	"go.opentelemetry.io/otel"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
)

// TODO: move to dashboardsnapshots package
const (
	ActionSnapshotsCreate = "snapshots:create"
	ActionSnapshotsDelete = "snapshots:delete"
	ActionSnapshotsRead   = "snapshots:read"
)

const (
	ScopeDashboardsRoot   = "dashboards"
	ScopeDashboardsPrefix = "dashboards:uid:"

	ActionDashboardsCreate           = "dashboards:create"
	ActionDashboardsRead             = "dashboards:read"
	ActionDashboardsWrite            = "dashboards:write"
	ActionDashboardsDelete           = "dashboards:delete"
	ActionDashboardsPermissionsRead  = "dashboards.permissions:read"
	ActionDashboardsPermissionsWrite = "dashboards.permissions:write"
)

var (
	ScopeDashboardsProvider = ac.NewScopeProvider(ScopeDashboardsRoot)
	ScopeDashboardsAll      = ScopeDashboardsProvider.GetResourceAllScope()
	tracer                  = otel.Tracer("github.com/grafana/grafana/pkg/services/dashboards")
)

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

	result, err := folder.GetInheritedScopes(ctx, orgID, folderUID, folderSvc)
	if err != nil {
		return nil, err
	}

	result = append([]string{
		ScopeDashboardsProvider.GetResourceScopeUID(dashboard.UID),
		folder.ScopeFoldersProvider.GetResourceScopeUID(folderUID),
	},
		result...,
	)

	return result, nil
}
