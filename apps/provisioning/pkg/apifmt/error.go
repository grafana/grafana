// apifmt aims to provide a Kubernetes-compatible way to format text.
package apifmt

import (
	"errors"
	"fmt"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

var (
	_ error               = (*fmtError)(nil)
	_ apierrors.APIStatus = (*fmtError)(nil)
)

type fmtError struct {
	inner error
	str   string

	innerStatusErr     apierrors.APIStatus
	initInnerStatusErr bool
}

func (e *fmtError) Error() string {
	return e.str
}

// Status returns the status that is closest in the tree, in a depth-first search.
func (e *fmtError) Status() metav1.Status {
	if !e.initInnerStatusErr {
		if status, ok := e.inner.(apierrors.APIStatus); ok || errors.As(e.inner, &status) {
			e.innerStatusErr = status
		}
		e.initInnerStatusErr = true
	}

	status := metav1.Status{
		Message: e.str,
		Code:    http.StatusInternalServerError,
		Reason:  metav1.StatusReasonInternalError,
		Status:  metav1.StatusFailure,
	}

	if e.innerStatusErr != nil {
		s := e.innerStatusErr.Status()
		status.Code, status.Reason, status.Status, status.Details = s.Code, s.Reason, s.Status, s.Details
	}
	return status
}

func (e *fmtError) Unwrap() error {
	return e.inner
}

func (e *fmtError) Is(target error) bool {
	if e.initInnerStatusErr && e.innerStatusErr != nil {
		// If we already know the inner status, we can speed up the Is check for apierrors Is functions. These are the most common case.
		if err, ok := e.innerStatusErr.(error); ok {
			return errors.Is(err, target)
		}
	}
	return errors.Is(e.inner, target)
}

// Errorf acts like `fmt.Errorf`. Use `%w` to wrap a specific error.
// The returned error will propagate the inner `metav1.Status`, if one exists. Otherwise, an HTTP 500 Internal Server Error will be returned.
// If multiple errors are passed, they will be joined with `errors.Join`, just like `fmt.Errorf`.
func Errorf(format string, args ...any) *fmtError {
	// We go via Errorf to only give the %w errors as inner errors.
	wrapped := fmt.Errorf(format, args...)
	str := wrapped.Error()
	err := unwrap(wrapped)

	return &fmtError{
		inner: err,
		str:   str,
	}
}

// unwrap returns the inner error of an error, if it exists.
// If multiple errors are present, it will errors.Join them.
func unwrap(err error) error {
	type singleUnwrapper interface {
		Unwrap() error
	}
	type multiUnwrapper interface {
		Unwrap() []error
	}

	if err == nil {
		return nil
	}
	if e, ok := err.(singleUnwrapper); ok {
		return e.Unwrap()
	}
	if e, ok := err.(multiUnwrapper); ok {
		errs := e.Unwrap()
		if len(errs) == 0 {
			return err
		}
		if len(errs) == 1 && errs[0] != nil {
			return errs[0]
		}
		return errors.Join(errs...)
	}
	return err
}
