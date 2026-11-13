package team

import (
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestWrapListError(t *testing.T) {
	t.Run("keeps a status error as is", func(t *testing.T) {
		notFound := apierrors.NewNotFound(schema.GroupResource{Resource: "namespace"}, "stacks-1")
		got := wrapListError(fmt.Errorf("loading stack: %w", notFound))

		require.Equal(t, notFound, got, "must be the status error itself, not a wrapper around it")
		var status apierrors.APIStatus
		require.ErrorAs(t, got, &status)
		require.EqualValues(t, http.StatusNotFound, status.Status().Code)
	})

	t.Run("wraps other errors with context", func(t *testing.T) {
		cause := errors.New("boom")
		got := wrapListError(cause)

		require.ErrorIs(t, got, cause)
		require.EqualError(t, got, "failed to list teams: boom")
	})
}
