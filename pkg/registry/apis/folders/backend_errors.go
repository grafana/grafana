package folders

import (
	"context"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	foldererrors "github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/infra/log"
)

var backendLogger log.Logger = log.New("folders")

// Backend statuses may contain diagnostics even when they are already Kubernetes
// errors. Retain only classification and retry hints, not messages or identities.
func backendStatusError(err error) apierrors.StatusError {
	mapped := foldererrors.ToFolderStatusError(err)
	code := int(mapped.ErrStatus.Code)
	switch {
	case apierrors.IsNotFound(&mapped):
		code = http.StatusNotFound
	case apierrors.IsForbidden(&mapped):
		code = http.StatusForbidden
	}
	if code < 400 || code > 599 {
		code = http.StatusInternalServerError
	}
	retryAfter := 0
	if details := mapped.ErrStatus.Details; details != nil && details.RetryAfterSeconds > 0 {
		retryAfter = int(details.RetryAfterSeconds)
	}
	public := apierrors.NewGenericServerResponse(code, "", schema.GroupResource{}, "", "", retryAfter, false)
	if code == http.StatusForbidden && public.ErrStatus.Message == "" {
		public.ErrStatus.Message = "Access denied"
	}
	// Retry classification can differ from the HTTP code's default reason;
	// ServerTimeout, for example, uses 500 but must remain retryable.
	switch mapped.ErrStatus.Reason {
	case metav1.StatusReasonUnknown:
		// Keep the classification derived from the HTTP code when no reason is supplied.
	case metav1.StatusReasonUnauthorized, metav1.StatusReasonForbidden,
		metav1.StatusReasonNotFound, metav1.StatusReasonAlreadyExists,
		metav1.StatusReasonConflict, metav1.StatusReasonGone,
		metav1.StatusReasonInvalid, metav1.StatusReasonServerTimeout,
		metav1.StatusReasonStoreReadError, metav1.StatusReasonTimeout,
		metav1.StatusReasonTooManyRequests, metav1.StatusReasonBadRequest,
		metav1.StatusReasonMethodNotAllowed, metav1.StatusReasonNotAcceptable,
		metav1.StatusReasonRequestEntityTooLarge, metav1.StatusReasonUnsupportedMediaType,
		metav1.StatusReasonInternalError, metav1.StatusReasonExpired,
		metav1.StatusReasonServiceUnavailable:
		public.ErrStatus.Reason = mapped.ErrStatus.Reason
	}
	if code == 499 {
		public.ErrStatus.Message = "Request canceled"
		public.ErrStatus.Reason = "ClientClosedRequest"
	}
	return *public
}

func sanitizedBackendError(ctx context.Context, operation string, err error) error {
	backendLogger.FromContext(ctx).Error("Folder backend operation failed", "operation", operation, "error", err)
	public := backendStatusError(err)
	return &public
}
