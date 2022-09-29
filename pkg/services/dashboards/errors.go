package dashboards

import (
	"errors"

	"github.com/grafana/grafana/pkg/util"
)

// Typed errors
var (
	ErrDashboardNotFound = DashboardErr{
		Reason:     "Dashboard not found",
		StatusCode: 404,
		Status:     "not-found",
	}
	ErrDashboardCorrupt = DashboardErr{
		Reason:     "Dashboard data is missing or corrupt",
		StatusCode: 500,
		Status:     "not-found",
	}
	ErrDashboardPanelNotFound = DashboardErr{
		Reason:     "Dashboard panel not found",
		StatusCode: 404,
		Status:     "not-found",
	}
	ErrDashboardFolderNotFound = DashboardErr{
		Reason:     "Folder not found",
		StatusCode: 404,
	}
	ErrDashboardWithSameUIDExists = DashboardErr{
		Reason:     "A dashboard with the same uid already exists",
		StatusCode: 400,
	}
	ErrDashboardWithSameNameInFolderExists = DashboardErr{
		Reason:     "A dashboard with the same name in the folder already exists",
		StatusCode: 412,
		Status:     "name-exists",
	}
	ErrDashboardVersionMismatch = DashboardErr{
		Reason:     "The dashboard has been changed by someone else",
		StatusCode: 412,
		Status:     "version-mismatch",
	}
	ErrDashboardTitleEmpty = DashboardErr{
		Reason:     "Dashboard title cannot be empty",
		StatusCode: 400,
		Status:     "empty-name",
	}
	ErrDashboardFolderCannotHaveParent = DashboardErr{
		Reason:     "A Dashboard Folder cannot be added to another folder",
		StatusCode: 400,
	}
	ErrDashboardsWithSameSlugExists = DashboardErr{
		Reason:     "Multiple dashboards with the same slug exists",
		StatusCode: 412,
	}
	ErrDashboardFailedGenerateUniqueUid = DashboardErr{
		Reason:     "Failed to generate unique dashboard id",
		StatusCode: 500,
	}
	ErrDashboardTypeMismatch = DashboardErr{
		Reason:     "Dashboard cannot be changed to a folder",
		StatusCode: 400,
	}
	ErrDashboardFolderWithSameNameAsDashboard = DashboardErr{
		Reason:     "Folder name cannot be the same as one of its dashboards",
		StatusCode: 400,
	}
	ErrDashboardWithSameNameAsFolder = DashboardErr{
		Reason:     "Dashboard name cannot be the same as folder",
		StatusCode: 400,
		Status:     "name-match",
	}
	ErrDashboardFolderNameExists = DashboardErr{
		Reason:     "A folder with that name already exists",
		StatusCode: 400,
	}
	ErrDashboardUpdateAccessDenied = DashboardErr{
		Reason:     "Access denied to save dashboard",
		StatusCode: 403,
	}
	ErrDashboardInvalidUid = DashboardErr{
		Reason:     "uid contains illegal characters",
		StatusCode: 400,
	}
	ErrDashboardUidTooLong = DashboardErr{
		Reason:     "uid too long, max 40 characters",
		StatusCode: 400,
	}
	ErrDashboardCannotSaveProvisionedDashboard = DashboardErr{
		Reason:     "Cannot save provisioned dashboard",
		StatusCode: 400,
	}
	ErrDashboardRefreshIntervalTooShort = DashboardErr{
		Reason:     "Dashboard refresh interval is too low",
		StatusCode: 400,
	}
	ErrDashboardCannotDeleteProvisionedDashboard = DashboardErr{
		Reason:     "provisioned dashboard cannot be deleted",
		StatusCode: 400,
	}
	ErrDashboardIdentifierNotSet = DashboardErr{
		Reason:     "Unique identifier needed to be able to get a dashboard",
		StatusCode: 400,
	}
	ErrDashboardIdentifierInvalid = DashboardErr{
		Reason:     "Dashboard ID not a number",
		StatusCode: 400,
	}
	ErrDashboardPanelIdentifierInvalid = DashboardErr{
		Reason:     "Dashboard panel ID not a number",
		StatusCode: 400,
	}
	ErrDashboardOrPanelIdentifierNotSet = DashboardErr{
		Reason:     "Unique identifier needed to be able to get a dashboard panel",
		StatusCode: 400,
	}
	ErrProvisionedDashboardNotFound = DashboardErr{
		Reason:     "Dashboard is not provisioned",
		StatusCode: 404,
		Status:     "not-found",
	}
	ErrDashboardThumbnailNotFound = DashboardErr{
		Reason:     "Dashboard thumbnail not found",
		StatusCode: 404,
		Status:     "not-found",
	}

	ErrFolderNotFound                = errors.New("folder not found")
	ErrFolderVersionMismatch         = errors.New("the folder has been changed by someone else")
	ErrFolderTitleEmpty              = errors.New("folder title cannot be empty")
	ErrFolderWithSameUIDExists       = errors.New("a folder/dashboard with the same uid already exists")
	ErrFolderInvalidUID              = errors.New("invalid uid for folder provided")
	ErrFolderSameNameExists          = errors.New("a folder or dashboard in the general folder with the same name already exists")
	ErrFolderFailedGenerateUniqueUid = errors.New("failed to generate unique folder ID")
	ErrFolderAccessDenied            = errors.New("access denied to folder")
	ErrFolderContainsAlertRules      = errors.New("folder contains alert rules")
)

// DashboardErr represents a dashboard error.
type DashboardErr struct {
	StatusCode int
	Status     string
	Reason     string
}

// Equal returns whether equal to another DashboardErr.
func (e DashboardErr) Equal(o DashboardErr) bool {
	return o.StatusCode == e.StatusCode && o.Status == e.Status && o.Reason == e.Reason
}

// Error returns the error message.
func (e DashboardErr) Error() string {
	if e.Reason != "" {
		return e.Reason
	}
	return "Dashboard Error"
}

// Body returns the error's response body, if applicable.
func (e DashboardErr) Body() util.DynMap {
	if e.Status == "" {
		return nil
	}

	return util.DynMap{"status": e.Status, "message": e.Error()}
}

type UpdatePluginDashboardError struct {
	PluginId string
}

func (d UpdatePluginDashboardError) Error() string {
	return "Dashboard belongs to plugin"
}
