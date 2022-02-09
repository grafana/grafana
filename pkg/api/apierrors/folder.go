package apierrors

import (
	"errors"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/util"
)

// ToFolderErrorResponse returns a different response status according to the folder error type
func ToFolderErrorResponse(err error) response.Response {
	var dashboardErr models.DashboardErr
	if ok := errors.As(err, &dashboardErr); ok {
		return response.Error(dashboardErr.StatusCode, err.Error(), err)
	}

	if errors.Is(err, models.ErrFolderTitleEmpty) ||
		errors.Is(err, models.ErrDashboardTypeMismatch) ||
		errors.Is(err, models.ErrDashboardInvalidUid) ||
		errors.Is(err, models.ErrDashboardUidTooLong) ||
		errors.Is(err, models.ErrFolderContainsAlertRules) {
		return response.Error(400, err.Error(), nil)
	}

	if errors.Is(err, models.ErrFolderAccessDenied) {
		return response.Error(403, "Access denied", err)
	}

	if errors.Is(err, models.ErrFolderNotFound) {
		return response.JSON(404, util.DynMap{"status": "not-found", "message": models.ErrFolderNotFound.Error()})
	}

	if errors.Is(err, models.ErrFolderSameNameExists) ||
		errors.Is(err, models.ErrFolderWithSameUIDExists) {
		return response.Error(409, err.Error(), nil)
	}

	if errors.Is(err, models.ErrFolderVersionMismatch) {
		return response.JSON(412, util.DynMap{"status": "version-mismatch", "message": models.ErrFolderVersionMismatch.Error()})
	}

	return response.Error(500, "Folder API error", err)
}
