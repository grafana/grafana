package legacy

import (
	"context"

	dashboardsV0 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

// This does not check if you have permissions!

type DashboardQuery struct {
	OrgID int64
	UID   string // to select a single dashboard
	Limit int

	// Included in the continue token
	// This is the ID from the last dashboard sent in the previous page
	LastID int64

	// List dashboards with a deletion timestamp
	GetTrash bool

	// Get dashboards from the history table
	GetHistory bool
	Version    int64

	// The label requirements
	Labels []*resource.Requirement
}

func (r *DashboardQuery) UseHistoryTable() bool {
	return r.GetHistory || r.Version > 0
}

type LibraryPanelQuery struct {
	OrgID int64
	UID   string // to select a single dashboard
	Limit int64

	// Included in the continue token
	// This is the ID from the last dashboard sent in the previous page
	LastID int64
}

type DashboardAccess interface {
	resource.StorageBackend
	resource.ResourceIndexServer

	GetDashboard(ctx context.Context, orgId int64, uid string, version int64) (*dashboardsV0.Dashboard, int64, error)
	SaveDashboard(ctx context.Context, orgId int64, dash *dashboardsV0.Dashboard) (*dashboardsV0.Dashboard, bool, error)
	DeleteDashboard(ctx context.Context, orgId int64, uid string) (*dashboardsV0.Dashboard, bool, error)

	// Get a typed list
	GetLibraryPanels(ctx context.Context, query LibraryPanelQuery) (*dashboardsV0.LibraryPanelList, error)
}
