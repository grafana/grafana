package guardian

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/user"
)

type Provider struct{}

func ProvideService(
	store *sqlstore.SQLStore, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService, dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService,
) *Provider {
	if !ac.IsDisabled() {
		// TODO: Fix this hack, see https://github.com/grafana/grafana-enterprise/issues/2935
		InitAccessControlGuardian(store, ac, folderPermissionsService, dashboardPermissionsService, dashboardService)
	} else {
		InitLegacyGuardian(store, dashboardService)
	}
	return &Provider{}
}

func InitLegacyGuardian(store sqlstore.Store, dashSvc dashboards.DashboardService) {
	New = func(ctx context.Context, dashId int64, orgId int64, user *user.SignedInUser) DashboardGuardian {
		return newDashboardGuardian(ctx, dashId, orgId, user, store, dashSvc)
	}
}

func InitAccessControlGuardian(
	store sqlstore.Store, ac accesscontrol.AccessControl, folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService, dashboardService dashboards.DashboardService,
) {
	New = func(ctx context.Context, dashId int64, orgId int64, user *user.SignedInUser) DashboardGuardian {
		return NewAccessControlDashboardGuardian(ctx, dashId, user, store, ac, folderPermissionsService, dashboardPermissionsService, dashboardService)
	}
}
