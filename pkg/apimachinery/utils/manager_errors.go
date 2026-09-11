package utils

import (
	"errors"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

const (
	causeResourceManagerKindConflict         metav1.CauseType = "ResourceManagerKindConflict"
	legacyResourceManagerKindConflictMessage string           = "Cannot change resource manager kind; remove the existing manager first, then add the new one"
)

func NewResourceManagerKindConflictError(current, requested ManagerProperties) *apierrors.StatusError {
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status: metav1.StatusFailure,
		Code:   http.StatusForbidden,
		Reason: metav1.StatusReasonForbidden,
		Message: fmt.Sprintf("Cannot change resource manager kind from %q (identity %q) to %q (identity %q); remove the existing manager first, then add the new one",
			current.Kind, current.Identity, requested.Kind, requested.Identity),
		Details: &metav1.StatusDetails{
			Causes: []metav1.StatusCause{{
				Type:  causeResourceManagerKindConflict,
				Field: "metadata.annotations[" + AnnoKeyManagerKind + "]",
			}},
		},
	}}
}

func IsResourceManagerKindConflictError(err error) bool {
	var statusErr apierrors.APIStatus
	if !errors.As(err, &statusErr) {
		return false
	}
	status := statusErr.Status()
	if status.Code != http.StatusForbidden || status.Reason != metav1.StatusReasonForbidden {
		return false
	}
	if status.Details != nil {
		for _, cause := range status.Details.Causes {
			if cause.Type == causeResourceManagerKindConflict {
				return true
			}
		}
	}
	// Older API instances do not include a structured cause during rolling upgrades.
	return status.Message == legacyResourceManagerKindConflictMessage
}
