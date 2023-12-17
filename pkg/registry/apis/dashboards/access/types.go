package access

import (
	"context"

	"github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
)

type DashboardRow struct {
	Title string

	// Dashboard value
	Dash *v0alpha1.Dashboard

	// Size (in bytes) of the dashboard payload
	Bytes int

	// Last time the dashboard was updated
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
	GetDashboard(ctx context.Context, orgId int64, uid string) (*v0alpha1.Dashboard, error)
	GetDashboards(ctx context.Context, orgId int64, continueToken string) (DashboardRows, error)
}
