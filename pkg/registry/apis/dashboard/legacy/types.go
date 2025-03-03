package legacy

import (
	"context"

	dashboard "github.com/grafana/grafana/pkg/apis/dashboard"
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

	// Only folders
	GetFolders bool

	// The label requirements
	Labels []*resource.Requirement

	// DESC|ASC, how to order the IDs
	Order string // asc required to use lastID, desc required for export with history
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
	LegacyMigrator

	GetDashboard(ctx context.Context, orgId int64, uid string, version int64) (*dashboard.Dashboard, int64, error)
	SaveDashboard(ctx context.Context, orgId int64, dash *dashboard.Dashboard) (*dashboard.Dashboard, bool, error)
	DeleteDashboard(ctx context.Context, orgId int64, uid string) (*dashboard.Dashboard, bool, error)

	// Get a typed list
	GetLibraryPanels(ctx context.Context, query LibraryPanelQuery) (*dashboard.LibraryPanelList, error)
}
