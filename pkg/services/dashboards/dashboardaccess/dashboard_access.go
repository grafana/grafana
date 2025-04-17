package dashboardaccess

import (
	"errors"

	"github.com/grafana/grafana/pkg/util"
)

type PermissionType int

const (
	PERMISSION_VIEW PermissionType = 1 << iota
	PERMISSION_EDIT
	PERMISSION_ADMIN
)

func (p PermissionType) String() string {
	names := map[int]string{
		int(PERMISSION_VIEW):  "View",
		int(PERMISSION_EDIT):  "Edit",
		int(PERMISSION_ADMIN): "Admin",
	}
	return names[int(p)]
}

// Typed errors
var (
	ErrDashboardACLInfoMissing              = errors.New("user id and team id cannot both be empty for a dashboard permission")
	ErrDashboardPermissionDashboardEmpty    = errors.New("dashboard id must be greater than zero for a dashboard permission")
	ErrFolderACLInfoMissing                 = errors.New("user id and team id cannot both be empty for a folder permission")
	ErrFolderPermissionFolderEmpty          = errors.New("folder id must be greater than zero for a folder permission")
	ErrPermissionsWithRoleNotAllowed        = errors.New("permissions cannot have both a user and team")
	ErrPermissionsWithUserAndTeamNotAllowed = errors.New("team and user permissions cannot have an associated role")
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
