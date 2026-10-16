package apierrors

import (
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

type folderErrorMapping struct {
	code     int
	message  string
	response response.Response
}

func newFolderErrorMapping(code int, message string, err error) folderErrorMapping {
	return folderErrorMapping{code: code, message: message, response: response.Error(code, message, err)}
}

// ToFolderErrorResponse returns a different response status according to the folder error type
func ToFolderErrorResponse(err error) response.Response {
	return mapFolderError(err).response
}

func mapFolderError(err error) folderErrorMapping {
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
		return newFolderErrorMapping(dashboardErr.StatusCode, msg, err)
	}

	// --- 400 Bad Request ---
	if errors.Is(err, folder.ErrTitleEmpty) ||
		errors.Is(err, folder.ErrFolderCannotBeParentOfItself) ||
		errors.Is(err, folder.ErrMaximumDepthReached) ||
		errors.Is(err, folder.ErrInvalidUID) {
		if _, ok := errors.AsType[errutil.Error](err); ok {
			for _, s := range stableFolderErrSentinels {
				if errors.Is(err, s) {
					return newFolderErrorMapping(http.StatusBadRequest, s.Error(), nil)
				}
			}
		}
		return newFolderErrorMapping(http.StatusBadRequest, err.Error(), nil)
	}

	// --- 403 Forbidden ---
	if errors.Is(err, folder.ErrAccessDenied) {
		return newFolderErrorMapping(http.StatusForbidden, "Access denied", err)
	}

	// --- 404 Not Found ---
	if errors.Is(err, folder.ErrFolderNotFound) ||
		errors.Is(err, dashboards.ErrFolderNotFound) {
		message := dashboards.ErrFolderNotFound.Error()
		return folderErrorMapping{
			code: http.StatusNotFound, message: message,
			response: response.JSON(http.StatusNotFound, util.DynMap{"status": "not-found", "message": message}),
		}
	}

	statusErr := storageStatusError(err)

	// --- 409 Conflict ---
	if isFolderAlreadyExists(err, statusErr) {
		return newFolderErrorMapping(http.StatusConflict, "a folder with the same UID already exists", err)
	}

	// --- 412 Precondition Failed ---
	if errors.Is(err, folder.ErrVersionMismatch) {
		message := folder.ErrVersionMismatch.Error()
		return folderErrorMapping{
			code: http.StatusPreconditionFailed, message: message,
			response: response.JSON(http.StatusPreconditionFailed, util.DynMap{"status": "version-mismatch", "message": message}),
		}
	}

	// A storage conflict can be write contention rather than a confirmed duplicate UID.
	if statusErr != nil && (statusErr.ErrStatus.Code == http.StatusConflict || k8sErrors.IsConflict(statusErr)) {
		return newFolderErrorMapping(http.StatusConflict, "the folder operation conflicted with another request; please retry", err)
	}

	// --- Kubernetes status errors ---
	if statusErr != nil {
		message := statusErr.ErrStatus.Message
		if message == "" {
			message = getDefaultMessageForStatus(int(statusErr.ErrStatus.Code))
		}
		return newFolderErrorMapping(int(statusErr.ErrStatus.Code), message, err)
	}

	message := fmt.Sprintf("Folder API error: %s", err.Error())
	resp := response.ErrOrFallback(http.StatusInternalServerError, message, err)
	if publicErr, ok := errors.AsType[errutil.Error](resp.Err()); ok {
		message = publicErr.Public().Message
	}
	return folderErrorMapping{code: resp.Status(), message: message, response: resp}
}

func isFolderAlreadyExists(err error, statusErr *k8sErrors.StatusError) bool {
	return errors.Is(err, folder.ErrSameUIDExists) ||
		k8sErrors.IsAlreadyExists(err) || (statusErr != nil && k8sErrors.IsAlreadyExists(statusErr))
}

func ToFolderStatusError(err error) k8sErrors.StatusError {
	mapped := mapFolderError(err)
	statusErr := k8sErrors.StatusError{
		ErrStatus: metav1.Status{
			Message: mapped.message,
			Code:    int32(mapped.code),
		},
	}

	// folderStorage.Create wraps errors in a StatusError before the legacy API consumes them.
	// Keep AlreadyExists distinct from other 409s so duplicates do not become retry conflicts.
	if statusErr.ErrStatus.Code == http.StatusConflict {
		statusErr.ErrStatus.Reason = metav1.StatusReasonConflict
		if isFolderAlreadyExists(err, storageStatusError(err)) {
			statusErr.ErrStatus.Reason = metav1.StatusReasonAlreadyExists
		}
	}

	// Preserve the structured errutil message ID in Status.Details.UID so
	// downstream consumers (e.g. provisioning's IsFolderValidationAPIError)
	// can match the rejection without relying on the human-readable message.
	// errutil.Error.Status() is the source of truth for the message ID; if
	// the underlying error is one, copy its Details across.
	if grafanaErr, ok := errors.AsType[errutil.Error](err); ok {
		if details := grafanaErr.Status().Details; details != nil {
			statusErr.ErrStatus.Details = details
		}
	}

	original, ok := errors.AsType[*k8sErrors.StatusError](err)
	if !ok {
		return statusErr
	}

	// Do not attach storage metadata when legacy normalization changed the error's meaning.
	// Correcting a reason-only conflict's default 500 code does not change its meaning.
	sameCode := original.ErrStatus.Code == statusErr.ErrStatus.Code
	sameReason := statusErr.ErrStatus.Reason != "" && original.ErrStatus.Reason == statusErr.ErrStatus.Reason
	if !sameCode && !sameReason {
		return statusErr
	}

	if statusErr.ErrStatus.Reason == "" {
		statusErr.ErrStatus.Reason = original.ErrStatus.Reason
	}
	if details := original.ErrStatus.Details; details != nil {
		if statusErr.ErrStatus.Details == nil {
			statusErr.ErrStatus.Details = details.DeepCopy()
		} else if statusErr.ErrStatus.Details.RetryAfterSeconds == 0 {
			statusErr.ErrStatus.Details = statusErr.ErrStatus.Details.DeepCopy()
			statusErr.ErrStatus.Details.RetryAfterSeconds = details.RetryAfterSeconds
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
