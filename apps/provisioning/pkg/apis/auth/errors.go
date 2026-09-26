package auth

import (
	"errors"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

// IsPermissionDenied distinguishes a negative permission decision from an access
// check failure, which also retains a Forbidden API status for compatibility.
func IsPermissionDenied(err error) bool {
	var checkErr *accessCheckError
	return !errors.As(err, &checkErr) && apierrors.IsForbidden(err)
}

type accessCheckError struct {
	*apierrors.StatusError
	cause error
}

func (e *accessCheckError) Unwrap() []error {
	return []error{e.StatusError, e.cause}
}
