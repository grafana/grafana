package utils

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
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

// Ensures that the passed error is an APIStatus error and fails the test if it is not.
func RequireApiErrorStatus(t *testing.T, err error, reason metav1.StatusReason, httpCode int) metav1.Status {
	require.Error(t, err)
	status, ok := ExtractApiErrorStatus(err)
	if !ok {
		t.Fatalf("Expected error to be an APIStatus, but got %T", err)
	}

	if reason != metav1.StatusReasonUnknown {
		require.Equal(t, status.Reason, reason)
	}

	if httpCode != 0 {
		require.Equal(t, status.Code, int32(httpCode))
	}

	return status
}
