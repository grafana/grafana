package utils

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestNewResourceManagerKindConflictError(t *testing.T) {
	for _, current := range []ManagerProperties{
		{Kind: ManagerKindTerraform, Identity: "terraform-provider"},
		{Kind: ManagerKindClassicFP}, //nolint:staticcheck
	} {
		t.Run(string(current.Kind), func(t *testing.T) {
			requested := ManagerProperties{Kind: ManagerKindRepo, Identity: "dashboards"}
			err := NewResourceManagerKindConflictError(current, requested)
			require.True(t, apierrors.IsForbidden(err))
			require.Equal(t, int32(http.StatusForbidden), err.Status().Code)
			require.Equal(t, metav1.StatusReasonForbidden, err.Status().Reason)
			require.Contains(t, err.Error(), fmt.Sprintf("from %q (identity %q)", current.Kind, current.Identity))
			require.Contains(t, err.Error(), `to "repo" (identity "dashboards")`)
			require.Contains(t, err.Error(), "remove the existing manager first, then add the new one")
			require.True(t, apierrors.HasStatusCause(err, "ResourceManagerKindConflict"))
		})
	}
}

func TestIsResourceManagerKindConflictError(t *testing.T) {
	conflict := NewResourceManagerKindConflictError(
		ManagerProperties{Kind: ManagerKindTerraform, Identity: "terraform-provider"},
		ManagerProperties{Kind: ManagerKindRepo, Identity: "dashboards"},
	)
	data, err := json.Marshal(conflict.Status())
	require.NoError(t, err)
	var serialized apierrors.StatusError
	require.NoError(t, json.Unmarshal(data, &serialized.ErrStatus))

	legacy := &apierrors.StatusError{ErrStatus: metav1.Status{
		Code: http.StatusForbidden, Reason: metav1.StatusReasonForbidden,
		Message: "Cannot change resource manager kind; remove the existing manager first, then add the new one",
	}}
	structuredOnly := &apierrors.StatusError{ErrStatus: *conflict.ErrStatus.DeepCopy()}
	structuredOnly.ErrStatus.Message = "changed human-readable message"
	serverError := &apierrors.StatusError{ErrStatus: *conflict.ErrStatus.DeepCopy()}
	serverError.ErrStatus.Code = http.StatusInternalServerError
	serverError.ErrStatus.Reason = metav1.StatusReasonInternalError
	unrelated := &apierrors.StatusError{ErrStatus: metav1.Status{
		Code: http.StatusForbidden, Reason: metav1.StatusReasonForbidden, Message: "access denied",
	}}
	identityConflict := &apierrors.StatusError{ErrStatus: metav1.Status{
		Code: http.StatusForbidden, Reason: metav1.StatusReasonForbidden,
		Message: "Cannot change resource manager identity; remove the existing manager first, then add the new one",
	}}
	unknownCause := &apierrors.StatusError{ErrStatus: *structuredOnly.ErrStatus.DeepCopy()}
	unknownCause.ErrStatus.Details.Causes[0].Type = "AnotherConflict"
	legacyServerError := &apierrors.StatusError{ErrStatus: *legacy.ErrStatus.DeepCopy()}
	legacyServerError.ErrStatus.Code = http.StatusInternalServerError
	legacyServerError.ErrStatus.Reason = metav1.StatusReasonInternalError

	for _, tt := range []struct {
		name string
		err  error
		want bool
	}{
		{"structured", conflict, true},
		{"structured without matching message", structuredOnly, true},
		{"serialized", &serialized, true},
		{"wrapped serialized", fmt.Errorf("writing resource: %w", &serialized), true},
		{"legacy", legacy, true},
		{"wrapped legacy", fmt.Errorf("writing resource: %w", legacy), true},
		{"nil", nil, false},
		{"unrelated forbidden", unrelated, false},
		{"identity conflict", identityConflict, false},
		{"unknown cause", unknownCause, false},
		{"server failure with cause", serverError, false},
		{"server failure with legacy message", legacyServerError, false},
		{"plain legacy message", errors.New(legacy.Error()), false},
		{"legacy prefix only", &apierrors.StatusError{ErrStatus: metav1.Status{
			Code: http.StatusForbidden, Reason: metav1.StatusReasonForbidden,
			Message: legacy.Error() + "; another failure",
		}}, false},
	} {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, IsResourceManagerKindConflictError(tt.err))
		})
	}
}
