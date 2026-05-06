package dashboards

import (
	"errors"

	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
)

// Typed errors
var (
	ErrDashboardNotFound = dashboardaccess.DashboardErr{
		Reason:     "Dashboard not found",
		StatusCode: 404,
		Status:     "not-found",
	}
	ErrDashboardWithSameUIDExists = dashboardaccess.DashboardErr{
		Reason:     "A dashboard with the same uid already exists",
		StatusCode: 400,
	}
	ErrDashboardVersionMismatch = dashboardaccess.DashboardErr{
		Reason:     "The dashboard has been changed by someone else",
		StatusCode: 412,
		Status:     "version-mismatch",
	}
	ErrDashboardTitleEmpty = dashboardaccess.DashboardErr{
		Reason:     "Dashboard title cannot be empty",
		StatusCode: 400,
		Status:     "empty-name",
	}
	ErrDashboardTitleTooLong = dashboardaccess.DashboardErr{
		Reason:     "Dashboard title cannot contain more than 5 000 characters",
		StatusCode: 400,
		Status:     "title-too-long",
	}
	ErrDashboardFolderCannotHaveParent = dashboardaccess.DashboardErr{
		Reason:     "A Dashboard Folder cannot be added to another folder",
		StatusCode: 400,
	}
	ErrDashboardTypeMismatch = dashboardaccess.DashboardErr{
		Reason:     "Dashboard cannot be changed to a folder",
		StatusCode: 400,
	}
	ErrDashboardUpdateAccessDenied = dashboardaccess.DashboardErr{
		Reason:     "Access denied to save dashboard",
		StatusCode: 403,
	}
	ErrDashboardInvalidUid = dashboardaccess.DashboardErr{
		Reason:     "uid contains illegal characters",
		StatusCode: 400,
	}
	ErrDashboardUidTooLong = dashboardaccess.DashboardErr{
		Reason:     "uid too long, max 40 characters",
		StatusCode: 400,
	}
	ErrDashboardMessageTooLong = dashboardaccess.DashboardErr{
		Reason:     "message too long, max 500 characters",
		StatusCode: 400,
	}
	ErrDashboardTagTooLong = dashboardaccess.DashboardErr{
		Reason:     "dashboard tag too long, max 50 characters",
		StatusCode: 400,
		Status:     "tag-too-long",
	}
	ErrDashboardCannotSaveProvisionedDashboard = dashboardaccess.DashboardErr{
		Reason:     "Cannot save provisioned dashboard",
		StatusCode: 400,
	}
	ErrDashboardRefreshIntervalTooShort = dashboardaccess.DashboardErr{
		Reason:     "Dashboard refresh interval is too low",
		StatusCode: 400,
	}
	ErrDashboardCannotDeleteProvisionedDashboard = dashboardaccess.DashboardErr{
		Reason:     "provisioned dashboard cannot be deleted",
		StatusCode: 400,
	}
	ErrDashboardIdentifierNotSet = dashboardaccess.DashboardErr{
		Reason:     "Unique identifier needed to be able to get a dashboard",
		StatusCode: 400,
	}
	ErrDashboardRestoreIdenticalVersion = dashboardaccess.DashboardErr{
		Reason:     "Current dashboard is identical to the specified version",
		StatusCode: 400,
	}
	ErrProvisionedDashboardNotFound = dashboardaccess.DashboardErr{
		Reason:     "Dashboard is not provisioned",
		StatusCode: 404,
		Status:     "not-found",
	}
	ErrQuotaReached = dashboardaccess.DashboardErr{
		Reason:     "Dashboard quota reached",
		StatusCode: 403,
		Status:     "quota-reached",
	}
	ErrFolderNotFound = errors.New("folder not found")
)

type UpdatePluginDashboardError struct {
	PluginId string
}

func (d UpdatePluginDashboardError) Error() string {
	return "Dashboard belongs to plugin"
}
