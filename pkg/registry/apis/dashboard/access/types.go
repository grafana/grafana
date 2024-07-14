package access

import (
	"context"

	"k8s.io/apimachinery/pkg/labels"

	dashboardsV0 "github.com/grafana/grafana/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/storage/entity"
)

// This does not check if you have permissions!

type DashboardQuery struct {
	OrgID    int64
	UID      string // to select a single dashboard
	Limit    int
	MaxBytes int

	// FolderUID etc
	Requirements entity.Requirements
	// Post processing label filter
	Labels labels.Selector

	// The token from previous query
	ContinueToken string
}

type DashboardAccess interface {
	GetDashboard(ctx context.Context, orgId int64, uid string) (*dashboardsV0.Dashboard, error)
	GetDashboards(ctx context.Context, query *DashboardQuery) (*dashboardsV0.DashboardList, error)

	SaveDashboard(ctx context.Context, orgId int64, dash *dashboardsV0.Dashboard) (*dashboardsV0.Dashboard, bool, error)
	DeleteDashboard(ctx context.Context, orgId int64, uid string) (*dashboardsV0.Dashboard, bool, error)
}
