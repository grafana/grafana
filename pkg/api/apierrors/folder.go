package apierrors

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	k8sErrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/util"
)

// stableFolderErrSentinels are folder errors whose legacy /api/folders messages are kept stable.
var stableFolderErrSentinels = []error{
	folder.ErrTitleEmpty,
	folder.ErrInvalidUID,
	folder.ErrFolderCannotBeParentOfItself,
}

// stableDashboardErrSentinels are dashboard errors whose legacy /api/folders messages are kept stable.
var stableDashboardErrSentinels = []error{
	dashboards.ErrDashboardInvalidUid,
	dashboards.ErrDashboardUidTooLong,
}

// ToFolderErrorResponse returns a different response status according to the folder error type
func ToFolderErrorResponse(err error) response.Response {
	// --- Dashboard errors ---
	var dashboardErr dashboardaccess.DashboardErr
	if ok := errors.As(err, &dashboardErr); ok {
		msg := err.Error()
		var grafanaErr errutil.Error
		if errors.As(err, &grafanaErr) {
			for _, s := range stableDashboardErrSentinels {
				if errors.Is(err, s) {
					msg = s.Error()
					break
				}
			}
		}
		return response.Error(dashboardErr.StatusCode, msg, err)
	}

	// --- 400 Bad Request ---
	if errors.Is(err, folder.ErrTitleEmpty) ||
		errors.Is(err, folder.ErrFolderCannotBeParentOfItself) ||
		errors.Is(err, folder.ErrMaximumDepthReached) ||
		errors.Is(err, folder.ErrInvalidUID) {
		var grafanaErr errutil.Error
		if errors.As(err, &grafanaErr) {
			for _, s := range stableFolderErrSentinels {
				if errors.Is(err, s) {
					return response.Error(http.StatusBadRequest, s.Error(), nil)
				}
			}
		}
		return response.Error(http.StatusBadRequest, err.Error(), nil)
	}

	// --- 403 Forbidden ---
	if errors.Is(err, folder.ErrAccessDenied) {
		return response.Error(http.StatusForbidden, "Access denied", err)
	}

	// --- 404 Not Found ---
	if errors.Is(err, folder.ErrFolderNotFound) ||
		errors.Is(err, dashboards.ErrFolderNotFound) {
		return response.JSON(http.StatusNotFound, util.DynMap{"status": "not-found", "message": dashboards.ErrFolderNotFound.Error()})
	}

	// --- 409 Conflict ---
	if errors.Is(err, folder.ErrSameUIDExists) {
		return response.Error(http.StatusConflict, err.Error(), nil)
	}

	// --- 412 Precondition Failed ---
	if errors.Is(err, folder.ErrVersionMismatch) ||
		k8sErrors.IsAlreadyExists(err) {
		return response.JSON(http.StatusPreconditionFailed, util.DynMap{"status": "version-mismatch", "message": folder.ErrVersionMismatch.Error()})
	}

	// --- Kubernetes status errors ---
	var statusErr *k8sErrors.StatusError
	if errors.As(err, &statusErr) {
		message := statusErr.ErrStatus.Message
		if message == "" {
			message = getDefaultMessageForStatus(int(statusErr.ErrStatus.Code))
		}
		return response.Error(int(statusErr.ErrStatus.Code), message, err)
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

	statusErr := k8sErrors.StatusError{
		ErrStatus: metav1.Status{
			Message: message,
			Code:    int32(normResp.Status()),
		},
	}

	// Preserve the structured errutil message ID in Status.Details.UID so
	// downstream consumers (e.g. provisioning's IsFolderValidationAPIError)
	// can match the rejection without relying on the human-readable message.
	// errutil.Error.Status() is the source of truth for the message ID; if
	// the underlying error is one, copy its Details across.
	var grafanaErr errutil.Error
	if errors.As(err, &grafanaErr) {
		if details := grafanaErr.Status().Details; details != nil {
			statusErr.ErrStatus.Details = details
		}
	}

	return statusErr
}

func getDefaultMessageForStatus(statusCode int) string {
	switch statusCode {
	case http.StatusForbidden:
		return "Access denied"
	case http.StatusNotFound:
		return "Folder not found"
	case http.StatusBadRequest:
		return "Invalid request"
	default:
		return "Folder API error"
	}
}

func IsForbidden(err error) bool {
	return k8sErrors.IsForbidden(err) || errors.Is(err, folder.ErrAccessDenied)
}
