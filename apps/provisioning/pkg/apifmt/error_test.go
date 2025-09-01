package apifmt_test

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/grafana/grafana/apps/provisioning/pkg/apifmt"
	"github.com/stretchr/testify/assert"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestErrorf(t *testing.T) {
	t.Parallel()

	for _, fmt := range []string{"1 %v 2 %v", "1 %w 2 %v", "1 %v 2 %w", "1 %w 2 %w"} {
		t.Run("error string is formatted appropriately with fmt="+fmt, func(t *testing.T) {
			t.Parallel()

			err1 := errors.New("error1")
			err2 := errors.New("error2")

			err := apifmt.Errorf(fmt, err1, err2)
			assert.Equal(t, "1 error1 2 error2", err.Error())
		})
	}

	t.Run("no inner error defaults to internal server error", func(t *testing.T) {
		t.Parallel()

		err := apifmt.Errorf("nothing inside")

		assert.True(t, apierrors.IsInternalError(err), "err is not internal error per apierrors")
		assert.Equal(t, int32(http.StatusInternalServerError), err.Status().Code, ".Code")
		assert.Equal(t, metav1.StatusReasonInternalError, err.Status().Reason, ".Reason")
		assert.Equal(t, metav1.StatusFailure, err.Status().Status, ".Status")
	})

	t.Run("non-apistatus inner error defaults to internal server error", func(t *testing.T) {
		t.Parallel()

		inner := errors.New("an inner error")
		err := apifmt.Errorf("%w", inner)

		assert.True(t, apierrors.IsInternalError(err), "err is not internal error per apierrors")
		assert.Equal(t, int32(http.StatusInternalServerError), err.Status().Code, ".Code")
		assert.Equal(t, metav1.StatusReasonInternalError, err.Status().Reason, ".Reason")
		assert.Equal(t, metav1.StatusFailure, err.Status().Status, ".Status")
	})

	t.Run("apistatus inner error is used for status", func(t *testing.T) {
		t.Parallel()

		inner := apierrors.NewBadRequest("bad request")
		err := apifmt.Errorf("%w", inner)

		assert.Equal(t, inner.Status(), err.Status(), "err.Status()")
	})

	t.Run("message is used with inner apistatus error", func(t *testing.T) {
		t.Parallel()

		inner := apierrors.NewBadRequest("bad request")
		err := apifmt.Errorf("context here: %w", inner)

		status := inner.Status()
		status.Message = "context here: bad request"
		assert.Equal(t, status, err.Status(), "err.Status()")
		assert.Equal(t, "context here: bad request", err.Error(), "err.Error()")
	})

	t.Run("deep apierror is used", func(t *testing.T) {
		t.Parallel()

		inner := apierrors.NewBadRequest("bad request")
		wrapped := fmt.Errorf("%w", inner)
		wrapped = fmt.Errorf("%w", wrapped)
		err := apifmt.Errorf("%w", wrapped)

		assert.Equal(t, inner.Status(), err.Status(), "err.Status()")
	})

	t.Run("deep error in multi-unwrap wrapper's apierror is used", func(t *testing.T) {
		t.Parallel()

		inner := apierrors.NewBadRequest("bad request")
		anotherError := errors.New("not an apierror")
		wrapped := errors.Join(fmt.Errorf("this is cool: %w", anotherError), fmt.Errorf("another one: %w", errors.Join(anotherError, inner, anotherError)))
		err := apifmt.Errorf("%w", wrapped)

		status := inner.Status()
		status.Message = "this is cool: not an apierror\nanother one: not an apierror\nbad request\nnot an apierror"
		assert.Equal(t, status, err.Status(), "err.Status()")
	})
}
