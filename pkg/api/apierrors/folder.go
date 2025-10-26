package apierrors

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	k8sErrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util"
)

// ToFolderErrorResponse returns a different response status according to the folder error type
func ToFolderErrorResponse(err error) response.Response {
	// --- Dashboard errors ---
	var dashboardErr dashboardaccess.DashboardErr
	if ok := errors.As(err, &dashboardErr); ok {
		return response.Error(dashboardErr.StatusCode, err.Error(), err)
	}

	// --- 400 Bad Request ---
	if errors.Is(err, dashboards.ErrFolderTitleEmpty) ||
		errors.Is(err, dashboards.ErrDashboardTypeMismatch) ||
		errors.Is(err, dashboards.ErrDashboardInvalidUid) ||
		errors.Is(err, dashboards.ErrDashboardUidTooLong) ||
		errors.Is(err, folder.ErrFolderCannotBeParentOfItself) {
		return response.Error(http.StatusBadRequest, err.Error(), nil)
	}

	// --- 403 Forbidden ---
	if errors.Is(err, dashboards.ErrFolderAccessDenied) {
		return response.Error(http.StatusForbidden, "Access denied", err)
	}

	// --- 404 Not Found ---
	if errors.Is(err, dashboards.ErrFolderNotFound) {
		return response.JSON(http.StatusNotFound, util.DynMap{"status": "not-found", "message": dashboards.ErrFolderNotFound.Error()})
	}

	// --- 409 Conflict ---
	if errors.Is(err, dashboards.ErrFolderWithSameUIDExists) {
		return response.Error(http.StatusConflict, err.Error(), nil)
	}

	// --- 412 Precondition Failed ---
	if errors.Is(err, dashboards.ErrFolderVersionMismatch) ||
		k8sErrors.IsAlreadyExists(err) {
		return response.JSON(http.StatusPreconditionFailed, util.DynMap{"status": "version-mismatch", "message": dashboards.ErrFolderVersionMismatch.Error()})
	}

	// --- Kubernetes status errors ---
	var statusErr *k8sErrors.StatusError
	if errors.As(err, &statusErr) {
		return response.Error(int(statusErr.ErrStatus.Code), statusErr.ErrStatus.Message, err)
	}

	return response.ErrOrFallback(http.StatusInternalServerError, fmt.Sprintf("Folder API error: %s", err.Error()), err)
}

func ToFolderStatusError(err error) k8sErrors.StatusError {
	resp := ToFolderErrorResponse(err)
	defaultErr := k8sErrors.StatusError{
		ErrStatus: metav1.Status{
			Message: "Folder API error",
			Code:    http.StatusInternalServerError,
		},
	}

	normResp, ok := resp.(*response.NormalResponse)
	if !ok {
		return defaultErr
	}

	var dat map[string]interface{}
	if err := json.Unmarshal(normResp.Body(), &dat); err != nil {
		return defaultErr
	}

	m, ok := dat["message"]
	if !ok {
		return defaultErr
	}

	message, ok := m.(string)
	if !ok {
		return defaultErr
	}

	return k8sErrors.StatusError{
		ErrStatus: metav1.Status{
			Message: message,
			Code:    int32(normResp.Status()),
		},
	}
}

func IsForbidden(err error) bool {
	return k8sErrors.IsForbidden(err) || errors.Is(err, dashboards.ErrFolderAccessDenied)
}
