package access

import (
	"context"

	dashboardsV0 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
)

// This does not check if you have permissions!

type DashboardQuery struct {
	OrgID     int64
	UID       string // to select a single dashboard
	FolderUID string
	Limit     int
	MaxBytes  int

	// The token from previous query
	ContinueToken string
}

type DashboardAccess interface {
	GetDashboard(ctx context.Context, orgId int64, uid string) (*dashboardsV0.Dashboard, error)
	GetDashboards(ctx context.Context, query *DashboardQuery) (*dashboardsV0.DashboardList, error)

	GetDashboardSummary(ctx context.Context, orgId int64, uid string) (*dashboardsV0.DashboardSummary, error)
	GetDashboardSummaries(ctx context.Context, query *DashboardQuery) (*dashboardsV0.DashboardSummaryList, error)

	SaveDashboard(ctx context.Context, orgId int64, dash *dashboardsV0.Dashboard) (*dashboardsV0.Dashboard, bool, error)
	DeleteDashboard(ctx context.Context, orgId int64, uid string) (*dashboardsV0.Dashboard, bool, error)
}
