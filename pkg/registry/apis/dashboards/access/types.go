package access

import (
	"context"

	dashboardsV0 "github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
)

type DashboardRow struct {
	// Dashboard resource
	Dash *dashboardsV0.Dashboard

	// Title -- this may come from saved metadata rather than the body
	Title string

	// The folder UID (needed for access control checks)
	FolderUID string

	// Needed for fast summary access
	Tags []string

	// Size (in bytes) of the dashboard payload
	Bytes int

	// Last time the dashboard was updated (used in the continue token)
	UpdatedTime int64

	// The token we can use that will start a new connection that includes
	// this same dashboard
	ContinueToken string
}

type DashboardRows interface {
	Close() error
	Next() (*DashboardRow, error)
}

// This does not check if you have permissions!
type DashboardAccess interface {
	GetDashboard(ctx context.Context, orgId int64, uid string) (*DashboardRow, error)
	GetDashboards(ctx context.Context, orgId int64, continueToken string, skipBody bool) (DashboardRows, error)
	SaveDashboard(ctx context.Context, orgId int64, dash *dashboardsV0.Dashboard) (string, bool, error)
	DeleteDashboard(ctx context.Context, orgId int64, uid string) (*dashboardsV0.Dashboard, bool, error)
}
