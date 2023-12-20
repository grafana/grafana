package access

import (
	"context"

	dashboardsV0 "github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
)

// This does not check if you have permissions!
type DashboardAccess interface {
	GetDashboard(ctx context.Context, orgId int64, uid string) (*dashboardsV0.Dashboard, error)
	GetDashboards(ctx context.Context, orgId int64, continueToken string, limit int, maxBytes int) (*dashboardsV0.DashboardList, error)

	GetDashboardSummary(ctx context.Context, orgId int64, uid string) (*dashboardsV0.DashboardSummary, error)
	GetDashboardSummaries(ctx context.Context, orgId int64, continueToken string, limit int, maxBytes int) (*dashboardsV0.DashboardSummaryList, error)

	SaveDashboard(ctx context.Context, orgId int64, dash *dashboardsV0.Dashboard) (*dashboardsV0.Dashboard, bool, error)
	DeleteDashboard(ctx context.Context, orgId int64, uid string) (*dashboardsV0.Dashboard, bool, error)
}
