package backend

import (
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Errors that may be returned by the storage backend, to be converted by the resource layer.
// These are defined here to let all storage backends use the same error types without depending on one another.
var (
	ErrResourceAlreadyExists error = &apierrors.StatusError{
		ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Reason:  metav1.StatusReasonAlreadyExists,
			Message: "the resource already exists",
			Code:    http.StatusConflict,
		},
	}
)
