package apierrors

import (
	"context"
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

func ToFolderStatusError(err error) k8sErrors.StatusError {
	status := metav1.Status{
		TypeMeta: metav1.TypeMeta{Kind: "Status", APIVersion: "v1"},
		Status:   metav1.StatusFailure,
		Message:  "Folder API error",
		Reason:   metav1.StatusReasonInternalError,
		Code:     http.StatusInternalServerError,
	}
	if err == nil {
		return k8sErrors.StatusError{ErrStatus: status}
	}

	if statusErr := storageStatusError(err); statusErr != nil {
		status = *statusErr.ErrStatus.DeepCopy()
		if status.Code == 499 {
			status.Message = "Request canceled"
			status.Reason = "ClientClosedRequest"
		} else if isFolderAlreadyExists(err, statusErr) {
			status.Code = http.StatusConflict
			status.Reason = metav1.StatusReasonAlreadyExists
			status.Message = "a folder with the same UID already exists"
		} else if status.Code == http.StatusConflict || k8sErrors.IsConflict(statusErr) {
			status.Code = http.StatusConflict
			status.Reason = metav1.StatusReasonConflict
			status.Message = "the folder operation conflicted with another request; please retry"
		} else {
			if status.Code == 0 {
				status.Code = http.StatusInternalServerError
			}
			if status.Message == "" {
				status.Message = getDefaultMessageForStatus(int(status.Code))
			}
			if status.Reason == "" {
				status.Reason = statusReasonForCode(int(status.Code))
			}
		}
		if status.Status == "" {
			status.Status = metav1.StatusFailure
		}
		if grafanaErr, ok := errors.AsType[errutil.Error](err); ok {
			status.Details = mergeFolderStatusDetails(status.Details, grafanaErr.Status().Details)
		}
		return k8sErrors.StatusError{ErrStatus: status}
	}

	if errors.Is(err, context.Canceled) {
		status.Message = "Request canceled"
		status.Reason = "ClientClosedRequest"
		status.Code = 499
		if grafanaErr, ok := errors.AsType[errutil.Error](err); ok {
			status.Details = mergeFolderStatusDetails(status.Details, grafanaErr.Status().Details)
		}
		return k8sErrors.StatusError{ErrStatus: status}
	}
	if errors.Is(err, context.DeadlineExceeded) {
		status.Message = "Gateway Timeout"
		status.Reason = metav1.StatusReasonTimeout
		status.Code = http.StatusGatewayTimeout
		if grafanaErr, ok := errors.AsType[errutil.Error](err); ok {
			status.Details = mergeFolderStatusDetails(status.Details, grafanaErr.Status().Details)
		}
		return k8sErrors.StatusError{ErrStatus: status}
	}

	if !isKnownFolderError(err) {
		return k8sErrors.StatusError{ErrStatus: status}
	}

	resp := ToFolderErrorResponse(err)
	normResp, ok := resp.(*response.NormalResponse)
	if !ok {
		return k8sErrors.StatusError{ErrStatus: status}
	}
	var dat map[string]interface{}
	if json.Unmarshal(normResp.Body(), &dat) != nil {
		return k8sErrors.StatusError{ErrStatus: status}
	}
	message, ok := dat["message"].(string)
	if !ok {
		return k8sErrors.StatusError{ErrStatus: status}
	}
	status.Code = int32(normResp.Status())
	status.Message = message
	status.Reason = statusReasonForCode(int(status.Code))
	if grafanaErr, ok := errors.AsType[errutil.Error](err); ok {
		grafanaStatus := grafanaErr.Status()
		if grafanaStatus.Reason != "" && grafanaStatus.Code == status.Code {
			status.Reason = grafanaStatus.Reason
		}
		status.Details = mergeFolderStatusDetails(status.Details, grafanaStatus.Details)
	}
	if status.Code == http.StatusConflict && isFolderAlreadyExists(err, nil) {
		status.Reason = metav1.StatusReasonAlreadyExists
	}
	return k8sErrors.StatusError{ErrStatus: status}
}

func isKnownFolderError(err error) bool {
	if _, ok := errors.AsType[errutil.Error](err); ok {
		return true
	}
	var dashboardErr dashboardaccess.DashboardErr
	if errors.As(err, &dashboardErr) {
		return true
	}
	for _, known := range []error{
		folder.ErrTitleEmpty,
		folder.ErrInvalidUID,
		folder.ErrFolderCannotBeParentOfItself,
		folder.ErrMaximumDepthReached,
		folder.ErrAccessDenied,
		folder.ErrFolderNotFound,
		folder.ErrSameUIDExists,
		folder.ErrVersionMismatch,
		dashboards.ErrFolderNotFound,
		dashboards.ErrDashboardTypeMismatch,
	} {
		if errors.Is(err, known) {
			return true
		}
	}
	for _, known := range stableDashboardErrSentinels {
		if errors.Is(err, known) {
			return true
		}
	}
	return false
}

func statusReasonForCode(code int) metav1.StatusReason {
	switch code {
	case http.StatusBadRequest:
		return metav1.StatusReasonBadRequest
	case http.StatusUnauthorized:
		return metav1.StatusReasonUnauthorized
	case http.StatusForbidden:
		return metav1.StatusReasonForbidden
	case http.StatusNotFound:
		return metav1.StatusReasonNotFound
	case http.StatusConflict:
		return metav1.StatusReasonConflict
	case http.StatusGone:
		return metav1.StatusReasonGone
	case http.StatusRequestEntityTooLarge:
		return metav1.StatusReasonRequestEntityTooLarge
	case http.StatusUnprocessableEntity:
		return metav1.StatusReasonInvalid
	case http.StatusTooManyRequests:
		return metav1.StatusReasonTooManyRequests
	case http.StatusInternalServerError:
		return metav1.StatusReasonInternalError
	case http.StatusServiceUnavailable:
		return metav1.StatusReasonServiceUnavailable
	case http.StatusGatewayTimeout:
		return metav1.StatusReasonTimeout
	default:
		return ""
	}
}

func mergeFolderStatusDetails(existing, additional *metav1.StatusDetails) *metav1.StatusDetails {
	if existing == nil && additional == nil {
		return nil
	}
	if existing == nil {
		return additional.DeepCopy()
	}
	merged := existing.DeepCopy()
	if additional == nil {
		return merged
	}
	if merged.Name == "" {
		merged.Name = additional.Name
	}
	if merged.Group == "" {
		merged.Group = additional.Group
	}
	if merged.Kind == "" {
		merged.Kind = additional.Kind
	}
	if additional.UID != "" {
		merged.UID = additional.UID
	}
	if merged.RetryAfterSeconds == 0 {
		merged.RetryAfterSeconds = additional.RetryAfterSeconds
	}
	merged.Causes = append(merged.Causes, additional.Causes...)
	return merged
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
