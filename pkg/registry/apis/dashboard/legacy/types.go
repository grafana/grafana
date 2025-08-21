package legacy

import (
	"context"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
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
	Labels []*resourcepb.Requirement

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
	resourcepb.ResourceIndexServer
	LegacyMigrator

	GetDashboard(ctx context.Context, orgId int64, uid string, version int64) (*dashboardV1.Dashboard, int64, error)
	SaveDashboard(ctx context.Context, orgId int64, dash *dashboardV1.Dashboard, failOnExisting bool) (*dashboardV1.Dashboard, bool, error)
	DeleteDashboard(ctx context.Context, orgId int64, uid string) (*dashboardV1.Dashboard, bool, error)

	// Get a typed list
	GetLibraryPanels(ctx context.Context, query LibraryPanelQuery) (*dashboardV0.LibraryPanelList, error)
	DeleteLibraryPanel(ctx context.Context, orgId int64, uid string) (*dashboardV0.LibraryPanel, bool, error)
	CreateLibraryPanel(ctx context.Context, orgId int64, panel *dashboardV0.LibraryPanel) (*dashboardV0.LibraryPanel, error)
	UpdateLibraryPanel(ctx context.Context, orgId int64, panel *dashboardV0.LibraryPanel) (*dashboardV0.LibraryPanel, error)
}
