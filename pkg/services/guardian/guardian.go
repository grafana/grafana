package guardian

import (
	"context"
	"slices"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
)

var (
	ErrGuardianGetDashboardFailure = errutil.Internal("guardian.getDashboardFailure", errutil.WithPublicMessage("Failed to get dashboard"))
	ErrGuardianDashboardNotFound   = errutil.NotFound("guardian.dashboardNotFound")
	ErrGuardianFolderNotFound      = errutil.NotFound("guardian.folderNotFound")
	ErrGuardianGetFolderFailure    = errutil.Internal("guardian.getFolderFailure", errutil.WithPublicMessage("Failed to get folder"))
)

// DashboardGuardian to be used for guard against operations without access on dashboard and acl
type DashboardGuardian interface {
	CanSave() (bool, error)
	CanEdit() (bool, error)
	CanView() (bool, error)
	CanAdmin() (bool, error)
	CanDelete() (bool, error)
	CanCreate(folderID int64, isFolder bool) (bool, error)
}

// New factory for creating a new dashboard guardian instance
// When using access control this function is replaced on startup and the AccessControlDashboardGuardian is returned
var New = func(ctx context.Context, dashId int64, orgId int64, user identity.Requester) (DashboardGuardian, error) {
	panic("no guardian factory implementation provided")
}

// NewByDashboard factory for creating a new dashboard guardian instance
// When using access control this function is replaced on startup and the AccessControlDashboardGuardian is returned
var NewByDashboard = func(ctx context.Context, dash *dashboards.Dashboard, orgId int64, user identity.Requester) (DashboardGuardian, error) {
	panic("no guardian factory implementation provided")
}

// NewByFolderUID factory for creating a new folder guardian instance
// When using access control this function is replaced on startup and the AccessControlDashboardGuardian is returned
var NewByFolderUID = func(ctx context.Context, folderUID string, orgId int64, user identity.Requester) (DashboardGuardian, error) {
	panic("no guardian factory implementation provided")
}

// NewByFolder factory for creating a new folder guardian instance
// When using access control this function is replaced on startup and the AccessControlDashboardGuardian is returned
var NewByFolder = func(ctx context.Context, f *folder.Folder, orgId int64, user identity.Requester) (DashboardGuardian, error) {
	panic("no guardian factory implementation provided")
}

// nolint:unused
type FakeDashboardGuardian struct {
	DashID        int64
	DashUID       string
	OrgID         int64
	User          identity.Requester
	CanSaveValue  bool
	CanEditValue  bool
	CanViewValue  bool
	CanAdminValue bool
	CanViewUIDs   []string
	CanEditUIDs   []string
	CanSaveUIDs   []string
}

func (g *FakeDashboardGuardian) CanSave() (bool, error) {
	if g.CanSaveUIDs != nil {
		return slices.Contains(g.CanSaveUIDs, g.DashUID), nil
	}
	return g.CanSaveValue, nil
}

func (g *FakeDashboardGuardian) CanEdit() (bool, error) {
	if g.CanEditUIDs != nil {
		return slices.Contains(g.CanEditUIDs, g.DashUID), nil
	}
	return g.CanEditValue, nil
}

func (g *FakeDashboardGuardian) CanView() (bool, error) {
	if g.CanViewUIDs != nil {
		return slices.Contains(g.CanViewUIDs, g.DashUID), nil
	}
	return g.CanViewValue, nil
}

func (g *FakeDashboardGuardian) CanAdmin() (bool, error) {
	return g.CanAdminValue, nil
}

func (g *FakeDashboardGuardian) CanDelete() (bool, error) {
	return g.CanSaveValue, nil
}

func (g *FakeDashboardGuardian) CanCreate(_ int64, _ bool) (bool, error) {
	return g.CanSaveValue, nil
}

// nolint:unused
func MockDashboardGuardian(mock *FakeDashboardGuardian) {
	New = func(_ context.Context, dashID int64, orgId int64, user identity.Requester) (DashboardGuardian, error) {
		mock.OrgID = orgId
		mock.DashID = dashID
		mock.User = user
		return mock, nil
	}
	NewByDashboard = func(_ context.Context, dash *dashboards.Dashboard, orgId int64, user identity.Requester) (DashboardGuardian, error) {
		mock.OrgID = orgId
		mock.DashUID = dash.UID
		mock.DashID = dash.ID
		mock.User = user
		return mock, nil
	}

	NewByFolderUID = func(_ context.Context, folderUID string, orgId int64, user identity.Requester) (DashboardGuardian, error) {
		mock.OrgID = orgId
		mock.DashUID = folderUID
		mock.User = user
		return mock, nil
	}

	NewByFolder = func(_ context.Context, f *folder.Folder, orgId int64, user identity.Requester) (DashboardGuardian, error) {
		mock.OrgID = orgId
		mock.DashUID = f.UID
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Guardian).Inc()
		// nolint:staticcheck
		mock.DashID = f.ID
		mock.User = user
		return mock, nil
	}
}
