package apierrors

import (
	"errors"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/util/errutil"
)

// ToFolderErrorResponse returns a different response status according to the folder error type
func ToFolderErrorResponse(err error) response.Response {
	if errors.As(err, &errutil.Error{}) {
		return response.Err(err)
	}

	var dashboardErr dashboards.DashboardErr
	if errors.As(err, &dashboardErr) {
		return response.Error(dashboardErr.StatusCode, err.Error(), err)
	}

	if errors.Is(err, dashboards.ErrDashboardTypeMismatch) ||
		errors.Is(err, dashboards.ErrDashboardInvalidUid) ||
		errors.Is(err, dashboards.ErrDashboardUidTooLong) {
		return response.Error(400, err.Error(), nil)
	}

	return response.Error(500, "Folder API error", err)
}
