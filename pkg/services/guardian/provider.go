package guardian

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type Provider struct{}

func ProvideService(
	cfg *setting.Cfg, store db.DB, ac accesscontrol.AccessControl,
	folderPermissionsService accesscontrol.FolderPermissionsService, dashboardPermissionsService accesscontrol.DashboardPermissionsService,
	dashboardService dashboards.DashboardService, teamService team.Service,
) *Provider {
	if !ac.IsDisabled() {
		// TODO: Fix this hack, see https://github.com/grafana/grafana-enterprise/issues/2935
		InitAccessControlGuardian(cfg, store, ac, folderPermissionsService, dashboardPermissionsService, dashboardService)
	} else {
		InitLegacyGuardian(cfg, store, dashboardService, teamService)
	}
	return &Provider{}
}

func InitLegacyGuardian(cfg *setting.Cfg, store db.DB, dashSvc dashboards.DashboardService, teamSvc team.Service) {
	New = func(ctx context.Context, dashId int64, orgId int64, user *user.SignedInUser) (DashboardGuardian, error) {
		return newDashboardGuardian(ctx, cfg, dashId, orgId, user, store, dashSvc, teamSvc)
	}

	NewByUID = func(ctx context.Context, dashUID string, orgId int64, user *user.SignedInUser) (DashboardGuardian, error) {
		return newDashboardGuardianByUID(ctx, cfg, dashUID, orgId, user, store, dashSvc, teamSvc)
	}

	NewByDashboard = func(ctx context.Context, dash *dashboards.Dashboard, orgId int64, user *user.SignedInUser) (DashboardGuardian, error) {
		return newDashboardGuardianByDashboard(ctx, cfg, dash, orgId, user, store, dashSvc, teamSvc)
	}
}

func InitAccessControlGuardian(
	cfg *setting.Cfg, store db.DB, ac accesscontrol.AccessControl, folderPermissionsService accesscontrol.FolderPermissionsService,
	dashboardPermissionsService accesscontrol.DashboardPermissionsService, dashboardService dashboards.DashboardService,
) {
	New = func(ctx context.Context, dashId int64, orgId int64, user *user.SignedInUser) (DashboardGuardian, error) {
		return NewAccessControlDashboardGuardian(ctx, cfg, dashId, user, store, ac, folderPermissionsService, dashboardPermissionsService, dashboardService)
	}

	NewByUID = func(ctx context.Context, dashUID string, orgId int64, user *user.SignedInUser) (DashboardGuardian, error) {
		return NewAccessControlDashboardGuardianByUID(ctx, cfg, dashUID, user, store, ac, folderPermissionsService, dashboardPermissionsService, dashboardService)
	}

	NewByDashboard = func(ctx context.Context, dash *dashboards.Dashboard, orgId int64, user *user.SignedInUser) (DashboardGuardian, error) {
		return NewAccessControlDashboardGuardianByDashboard(ctx, cfg, dash, user, store, ac, folderPermissionsService, dashboardPermissionsService, dashboardService)
	}
}
