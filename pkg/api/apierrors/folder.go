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
		if _, ok := errors.AsType[errutil.Error](err); ok {
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
		if _, ok := errors.AsType[errutil.Error](err); ok {
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

	statusErr := storageStatusError(err)

	// --- 409 Conflict ---
	if isFolderAlreadyExists(err, statusErr) {
		return response.Error(http.StatusConflict, "a folder with the same UID already exists", err)
	}

	// --- 412 Precondition Failed ---
	if errors.Is(err, folder.ErrVersionMismatch) {
		return response.JSON(http.StatusPreconditionFailed, util.DynMap{"status": "version-mismatch", "message": folder.ErrVersionMismatch.Error()})
	}

	// A storage conflict can be write contention rather than a confirmed duplicate UID.
	if statusErr != nil && (statusErr.ErrStatus.Code == http.StatusConflict || k8sErrors.IsConflict(statusErr)) {
		return response.Error(http.StatusConflict, "the folder operation conflicted with another request; please retry", err)
	}

	// --- Kubernetes status errors ---
	if statusErr != nil {
		message := statusErr.ErrStatus.Message
		if message == "" {
			message = getDefaultMessageForStatus(int(statusErr.ErrStatus.Code))
		}
		return response.Error(int(statusErr.ErrStatus.Code), message, err)
	}

	return response.ErrOrFallback(http.StatusInternalServerError, fmt.Sprintf("Folder API error: %s", err.Error()), err)
}

func isFolderAlreadyExists(err error, statusErr *k8sErrors.StatusError) bool {
	return errors.Is(err, folder.ErrSameUIDExists) ||
		k8sErrors.IsAlreadyExists(err) || (statusErr != nil && k8sErrors.IsAlreadyExists(statusErr))
}

// ToFolderStatusError adapts folder-create errors for the apiserver.
// Transport errors are translated by apistore before reaching this boundary.
func ToFolderStatusError(err error) k8sErrors.StatusError {
	if original, ok := errors.AsType[*k8sErrors.StatusError](err); ok {
		result := *original
		switch {
		case k8sErrors.IsAlreadyExists(original):
			result.ErrStatus.Code = http.StatusConflict
			result.ErrStatus.Reason = metav1.StatusReasonAlreadyExists
			result.ErrStatus.Message = "a folder with the same UID already exists"
		case original.ErrStatus.Code == http.StatusConflict || k8sErrors.IsConflict(original):
			result.ErrStatus.Code = http.StatusConflict
			result.ErrStatus.Reason = metav1.StatusReasonConflict
			result.ErrStatus.Message = "the folder operation conflicted with another request; please retry"
		case result.ErrStatus.Message == "":
			result.ErrStatus.Message = getDefaultMessageForStatus(int(result.ErrStatus.Code))
		}
		return result
	}

	defaultErr := k8sErrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Reason:  metav1.StatusReasonInternalError,
		Message: "Folder API error",
		Code:    http.StatusInternalServerError,
	}}
	grafanaErr, isGrafanaError := errors.AsType[errutil.Error](err)
	if !isGrafanaError && !isLegacyFolderError(err) {
		return defaultErr
	}

	// Reuse legacy message mapping so /api/folders responses remain compatible.
	resp := ToFolderErrorResponse(err)
	var body struct {
		Message string `json:"message"`
	}
	if err := json.Unmarshal(resp.Body(), &body); err != nil || body.Message == "" {
		return defaultErr
	}
	statusErr := k8sErrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    int32(resp.Status()),
		Message: body.Message,
	}}
	if isGrafanaError {
		// Provisioning identifies Grafana validation errors by the message ID in Details.UID.
		statusErr.ErrStatus.Details = grafanaErr.Status().Details
	}
	if statusErr.ErrStatus.Code == http.StatusConflict {
		statusErr.ErrStatus.Reason = metav1.StatusReasonConflict
		if isFolderAlreadyExists(err, nil) {
			statusErr.ErrStatus.Reason = metav1.StatusReasonAlreadyExists
		}
	}
	return statusErr
}

func isLegacyFolderError(err error) bool {
	if _, ok := errors.AsType[dashboardaccess.DashboardErr](err); ok {
		return true
	}
	for _, sentinel := range []error{
		folder.ErrTitleEmpty, folder.ErrInvalidUID, folder.ErrFolderCannotBeParentOfItself,
		folder.ErrAccessDenied, folder.ErrFolderNotFound, dashboards.ErrFolderNotFound,
		folder.ErrSameUIDExists, folder.ErrVersionMismatch,
	} {
		if errors.Is(err, sentinel) {
			return true
		}
	}
	return false
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
