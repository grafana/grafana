package dashboards

import (
	"errors"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
)

// Typed errors
var (
	ErrDashboardNotFound = dashboardaccess.DashboardErr{
		Reason:     "Dashboard not found",
		StatusCode: 404,
		Status:     "not-found",
	}
	ErrDashboardCorrupt = dashboardaccess.DashboardErr{
		Reason:     "Dashboard data is missing or corrupt",
		StatusCode: 500,
		Status:     "not-found",
	}
	ErrDashboardPanelNotFound = dashboardaccess.DashboardErr{
		Reason:     "Dashboard panel not found",
		StatusCode: 404,
		Status:     "not-found",
	}
	ErrDashboardFolderNotFound = dashboardaccess.DashboardErr{
		Reason:     "Folder not found",
		StatusCode: 404,
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
	ErrDashboardsWithSameSlugExists = dashboardaccess.DashboardErr{
		Reason:     "Multiple dashboards with the same slug exists",
		StatusCode: 412,
	}
	ErrDashboardTypeMismatch = dashboardaccess.DashboardErr{
		Reason:     "Dashboard cannot be changed to a folder",
		StatusCode: 400,
	}
	ErrDashboardFolderNameExists = dashboardaccess.DashboardErr{
		Reason:     "A folder with that name already exists",
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
	ErrDashboardIdentifierInvalid = dashboardaccess.DashboardErr{
		Reason:     "Dashboard ID not a number",
		StatusCode: 400,
	}
	ErrDashboardPanelIdentifierInvalid = dashboardaccess.DashboardErr{
		Reason:     "Dashboard panel ID not a number",
		StatusCode: 400,
	}
	ErrDashboardOrPanelIdentifierNotSet = dashboardaccess.DashboardErr{
		Reason:     "Unique identifier needed to be able to get a dashboard panel",
		StatusCode: 400,
	}
	ErrProvisionedDashboardNotFound = dashboardaccess.DashboardErr{
		Reason:     "Dashboard is not provisioned",
		StatusCode: 404,
		Status:     "not-found",
	}
	ErrFolderRestoreNotFound = dashboardaccess.DashboardErr{
		Reason:     "Restoring folder not found",
		StatusCode: 400,
		Status:     "bad-request",
	}
	ErrQuotaReached = dashboardaccess.DashboardErr{
		Reason:     "Dashboard quota reached",
		StatusCode: 403,
		Status:     "quota-reached",
	}

	ErrFolderNotFound             = errors.New("folder not found")
	ErrFolderVersionMismatch      = errors.New("the folder has been changed by someone else")
	ErrFolderTitleEmpty           = errors.New("folder title cannot be empty")
	ErrFolderWithSameUIDExists    = errors.New("a folder/dashboard with the same uid already exists")
	ErrFolderInvalidUID           = errors.New("invalid uid for folder provided")
	ErrFolderAccessDenied         = errors.New("access denied to folder")
	ErrUserIsNotSignedInToOrg     = errors.New("user is not signed in to organization")
	ErrMoveAccessDenied           = errutil.Forbidden("folders.forbiddenMove", errutil.WithPublicMessage("Access denied to the destination folder"))
	ErrFolderAccessEscalation     = errutil.Forbidden("folders.accessEscalation", errutil.WithPublicMessage("Cannot move a folder to a folder where you have higher permissions"))
	ErrFolderCreationAccessDenied = errutil.Forbidden("folders.forbiddenCreation", errutil.WithPublicMessage("not enough permissions to create a folder in the selected location"))
)

type UpdatePluginDashboardError struct {
	PluginId string
}

func (d UpdatePluginDashboardError) Error() string {
	return "Dashboard belongs to plugin"
}
