package guardian

import (
	"context"

	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrGuardianGetDashboardFailure = errutil.Internal("guardian.getDashboardFailure", errutil.WithPublicMessage("Failed to get dashboard"))
	ErrGuardianDashboardNotFound   = errutil.NotFound("guardian.dashboardNotFound")
	ErrGuardianFolderNotFound      = errutil.NotFound("guardian.folderNotFound")
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

// NewByUID factory for creating a new dashboard guardian instance
// When using access control this function is replaced on startup and the AccessControlDashboardGuardian is returned
var NewByUID = func(ctx context.Context, dashUID string, orgId int64, user identity.Requester) (DashboardGuardian, error) {
	panic("no guardian factory implementation provided")
}

// NewByDashboard factory for creating a new dashboard guardian instance
// When using access control this function is replaced on startup and the AccessControlDashboardGuardian is returned
var NewByDashboard = func(ctx context.Context, dash *dashboards.Dashboard, orgId int64, user identity.Requester) (DashboardGuardian, error) {
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
}

func (g *FakeDashboardGuardian) CanSave() (bool, error) {
	return g.CanSaveValue, nil
}

func (g *FakeDashboardGuardian) CanEdit() (bool, error) {
	return g.CanEditValue, nil
}

func (g *FakeDashboardGuardian) CanView() (bool, error) {
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

	NewByUID = func(_ context.Context, dashUID string, orgId int64, user identity.Requester) (DashboardGuardian, error) {
		mock.OrgID = orgId
		mock.DashUID = dashUID
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

	NewByFolder = func(_ context.Context, f *folder.Folder, orgId int64, user identity.Requester) (DashboardGuardian, error) {
		mock.OrgID = orgId
		mock.DashUID = f.UID
		mock.DashID = f.ID
		mock.User = user
		return mock, nil
	}
}
