package legacy

import (
	"context"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/migrations"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// This does not check if you have permissions!

type DashboardQuery struct {
	OrgID int64
	UID   string // to select a single dashboard
	Limit int

	DeprecatedInternalID int64 // to select a single dashboard

	// MaxRows is used internally by the iterator to fetch data in batches
	// When set, the SQL query will include LIMIT MaxRows
	// If Limit is smaller, that will be used instead
	MaxRows int

	// Included in the continue token
	// This is the ID from the last dashboard sent in the previous page
	LastID int64

	// List dashboards with a deletion timestamp
	GetTrash bool

	// Get dashboards from the history table
	GetHistory bool
	Version    int64

	// Allow fallback to dashboard table when version data is missing
	// Used during migration to handle dashboards without version entries.
	// Rows are ordered by (dashboard id, version) so the migration can page with AfterID/AfterVersion.
	AllowFallback bool

	// Migration keyset: return rows after (AfterID, AfterVersion). Only used with AllowFallback.
	AfterID      int64
	AfterVersion int64
	// Migration page bound: only dashboards with an id up to UpToID. Only used with AllowFallback.
	UpToID int64

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

type DashboardAccessor interface {
	GetLibraryPanels(ctx context.Context, query LibraryPanelQuery) (*dashboardV0.LibraryPanelList, error)
}

type Migrator interface {
	MigrateDashboards(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
	MigrateFolders(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
	MigrateLibraryPanels(ctx context.Context, orgId int64, opts migrations.MigrateOptions, stream resourcepb.BulkStore_BulkProcessClient) error
}
