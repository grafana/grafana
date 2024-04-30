package apierrors

import (
	"errors"
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/util"
)

// ToFolderErrorResponse returns a different response status according to the folder error type
func ToFolderErrorResponse(err error) response.Response {
	var dashboardErr dashboards.DashboardErr
	if ok := errors.As(err, &dashboardErr); ok {
		return response.Error(dashboardErr.StatusCode, err.Error(), err)
	}

	if errors.Is(err, dashboards.ErrFolderTitleEmpty) ||
		errors.Is(err, dashboards.ErrDashboardTypeMismatch) ||
		errors.Is(err, dashboards.ErrDashboardInvalidUid) ||
		errors.Is(err, dashboards.ErrDashboardUidTooLong) {
		return response.Error(http.StatusBadRequest, err.Error(), nil)
	}

	if errors.Is(err, dashboards.ErrFolderAccessDenied) {
		return response.Error(http.StatusForbidden, "Access denied", err)
	}

	if errors.Is(err, dashboards.ErrFolderNotFound) {
		return response.JSON(http.StatusNotFound, util.DynMap{"status": "not-found", "message": dashboards.ErrFolderNotFound.Error()})
	}

	if errors.Is(err, dashboards.ErrFolderSameNameExists) ||
		errors.Is(err, dashboards.ErrFolderWithSameUIDExists) {
		return response.Error(http.StatusConflict, err.Error(), nil)
	}

	if errors.Is(err, dashboards.ErrFolderVersionMismatch) {
		return response.JSON(http.StatusPreconditionFailed, util.DynMap{"status": "version-mismatch", "message": dashboards.ErrFolderVersionMismatch.Error()})
	}

	return response.ErrOrFallback(http.StatusInternalServerError, "Folder API error", err)
}
