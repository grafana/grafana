package guardian

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type Provider struct{}

func ProvideService(
	cfg *setting.Cfg, ac accesscontrol.AccessControl,
	dashboardService dashboards.DashboardService, teamService team.Service,
) *Provider {
	// TODO: Fix this hack, see https://github.com/grafana/grafana-enterprise/issues/2935
	InitAccessControlGuardian(cfg, ac, dashboardService)
	return &Provider{}
}

func InitAccessControlGuardian(
	cfg *setting.Cfg, ac accesscontrol.AccessControl, dashboardService dashboards.DashboardService,
) {
	New = func(ctx context.Context, dashId int64, orgId int64, user *user.SignedInUser) (DashboardGuardian, error) {
		return NewAccessControlDashboardGuardian(ctx, cfg, dashId, user, ac, dashboardService)
	}

	NewByUID = func(ctx context.Context, dashUID string, orgId int64, user *user.SignedInUser) (DashboardGuardian, error) {
		return NewAccessControlDashboardGuardianByUID(ctx, cfg, dashUID, user, ac, dashboardService)
	}

	NewByDashboard = func(ctx context.Context, dash *dashboards.Dashboard, orgId int64, user *user.SignedInUser) (DashboardGuardian, error) {
		return NewAccessControlDashboardGuardianByDashboard(ctx, cfg, dash, user, ac, dashboardService)
	}

	NewByFolder = func(ctx context.Context, f *folder.Folder, orgId int64, user *user.SignedInUser) (DashboardGuardian, error) {
		return NewAccessControlFolderGuardian(ctx, cfg, f, user, ac, dashboardService)
	}
}
