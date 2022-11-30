package guardian

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
)

type Provider struct{}

func ProvideService(
	store db.DB, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService, dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService, teamService team.Service,
) *Provider {
	if !ac.IsDisabled() {
		// TODO: Fix this hack, see https://github.com/grafana/grafana-enterprise/issues/2935
		InitAccessControlGuardian(store, ac, folderPermissionsService, dashboardPermissionsService, dashboardService)
	} else {
		InitLegacyGuardian(store, dashboardService, teamService)
	}
	return &Provider{}
}

func InitLegacyGuardian(store db.DB, dashSvc dashboards.DashboardService, teamSvc team.Service) {
	New = func(ctx context.Context, dashUID string, orgId int64, user *user.SignedInUser) (DashboardGuardian, error) {
		return newDashboardGuardian(ctx, dashUID, orgId, user, store, dashSvc, teamSvc)
	}
}

func InitAccessControlGuardian(
	store db.DB, ac accesscontrol.AccessControl, folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService, dashboardService dashboards.DashboardService,
) {
	New = func(ctx context.Context, dashUID string, orgId int64, user *user.SignedInUser) (DashboardGuardian, error) {
		return NewAccessControlDashboardGuardian(ctx, dashUID, user, store, ac, folderPermissionsService, dashboardPermissionsService, dashboardService)
	}
}
