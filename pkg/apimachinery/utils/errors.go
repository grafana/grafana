package utils

import (
	"errors"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Extract the status from an APIStatus error
func ExtractApiErrorStatus(err error) (metav1.Status, bool) {
	if err == nil {
		return metav1.Status{}, false
	}
	if statusErr, ok := err.(apierrors.APIStatus); ok && errors.As(err, &statusErr) {
		return statusErr.Status(), true
	}

	return metav1.Status{}, false
}
