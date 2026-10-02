package auth

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

func TestIsPermissionDenied(t *testing.T) {
	gr := schema.GroupResource{Group: "provisioning.grafana.app", Resource: "repositories"}
	denied := apierrors.NewForbidden(gr, "test-repo", errors.New("permission denied"))
	failure := &accessCheckError{StatusError: denied, cause: errors.New("backend unavailable")}

	for _, tt := range []struct {
		name   string
		err    error
		denied bool
	}{
		{name: "allowed"},
		{name: "permission denied", err: denied, denied: true},
		{name: "wrapped permission denied", err: fmt.Errorf("check: %w", denied), denied: true},
		{name: "unauthenticated", err: apierrors.NewUnauthorized("missing identity")},
		{name: "unexpected error", err: errors.New("unexpected error")},
		{name: "backend failure", err: failure},
		{name: "wrapped backend failure", err: fmt.Errorf("check: %w", failure)},
		{name: "forbidden backend failure", err: &accessCheckError{StatusError: denied, cause: denied}},
	} {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.denied, IsPermissionDenied(tt.err))
		})
	}
}

func TestAccessCheckError_PreservesStatusAndCause(t *testing.T) {
	cause := errors.New("backend unavailable")
	status := apierrors.NewForbidden(
		schema.GroupResource{Group: "provisioning.grafana.app", Resource: "repositories"},
		"test-repo",
		fmt.Errorf("repositories.provisioning.grafana.app is forbidden: %w", cause),
	)
	err := &accessCheckError{StatusError: status, cause: cause}

	assert.EqualError(t, err, status.Error())
	assert.True(t, apierrors.IsForbidden(err))
	assert.ErrorIs(t, err, cause)
	assert.ErrorIs(t, err, status)

	var apiStatus apierrors.APIStatus
	require.ErrorAs(t, err, &apiStatus)
	assert.Equal(t, status.Status(), apiStatus.Status())

	var statusError *apierrors.StatusError
	require.ErrorAs(t, err, &statusError)
	assert.Same(t, status, statusError)
}
