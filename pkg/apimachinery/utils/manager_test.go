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
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

func TestNewForbiddenManagerKindChangeError(t *testing.T) {
	for _, current := range []ManagerProperties{
		{Kind: ManagerKindTerraform, Identity: "terraform-provider"},
		{Kind: ManagerKindClassicFP}, //nolint:staticcheck
	} {
		t.Run(string(current.Kind), func(t *testing.T) {
			requested := ManagerProperties{Kind: ManagerKindRepo, Identity: "dashboards"}
			err := NewForbiddenManagerKindChangeError(current, requested)
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

func TestIsForbiddenManagerKindChangeError(t *testing.T) {
	conflict := NewForbiddenManagerKindChangeError(
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
			require.Equal(t, tt.want, IsForbiddenManagerKindChangeError(tt.err))
		})
	}
}

func TestParseManagerKindString(t *testing.T) {
	for _, kind := range []ManagerKind{
		ManagerKindRepo,
		ManagerKindTerraform,
		ManagerKindKubectl,
		ManagerKindPlugin,
		ManagerKindGrafana,
		ManagerKindFileProvisioning,
		ManagerKindClassicFP,                  //nolint:staticcheck
		ManagerKindClassicAPI,                 //nolint:staticcheck
		ManagerKindClassicConvertedPrometheus, //nolint:staticcheck
	} {
		t.Run(string(kind), func(t *testing.T) {
			require.Equal(t, kind, ParseManagerKindString(string(kind)))
		})
	}

	require.Equal(t, ManagerKindUnknown, ParseManagerKindString("something-else"))
	// File provisioning owns its resources for as long as they are configured, so unlike
	// the classic shims its identity is a stable one.
	require.False(t, ManagerKindFileProvisioning.IsClassic())
}

func TestCheckManagerPropertiesOnUpdate(t *testing.T) {
	const userAgentID = "Terraform/1.5.0 (+https://www.terraform.io) terraform-provider-grafana/v3.0.0"
	const otherUserAgentID = "Terraform/1.6.0 (+https://www.terraform.io) terraform-provider-grafana/v3.1.0"

	repo := ManagerProperties{Kind: ManagerKindRepo, Identity: "my-repo"}

	tests := []struct {
		name        string
		old         ManagerProperties
		proposed    ManagerProperties
		hasOld      bool
		hasProposed bool
		wantErr     string
	}{
		{
			name:        "unmanaged on both sides",
			hasOld:      false,
			hasProposed: false,
		},
		{
			name:        "adopting an unmanaged resource is not this function's call",
			proposed:    repo,
			hasProposed: true,
		},
		{
			name:   "removing a manager is not this function's call",
			old:    repo,
			hasOld: true,
		},
		{
			name:        "same manager",
			old:         repo,
			proposed:    repo,
			hasOld:      true,
			hasProposed: true,
		},
		{
			name:        "kind change",
			old:         repo,
			proposed:    ManagerProperties{Kind: ManagerKindTerraform, Identity: "my-repo"},
			hasOld:      true,
			hasProposed: true,
			wantErr:     "Cannot change resource manager kind",
		},
		{
			name:        "identity change",
			old:         repo,
			proposed:    ManagerProperties{Kind: ManagerKindRepo, Identity: "other-repo"},
			hasOld:      true,
			hasProposed: true,
			wantErr:     "Cannot change resource manager identity",
		},
		{
			name:        "allowEdits may change on the same manager",
			old:         repo,
			proposed:    ManagerProperties{Kind: ManagerKindRepo, Identity: "my-repo", AllowsEdits: true},
			hasOld:      true,
			hasProposed: true,
		},
		{
			name:        "a classic kind has no stable identity to pin",
			old:         ManagerProperties{Kind: ManagerKindClassicFP, Identity: "a.yaml"}, //nolint:staticcheck
			proposed:    ManagerProperties{Kind: ManagerKindClassicFP, Identity: "b.yaml"}, //nolint:staticcheck
			hasOld:      true,
			hasProposed: true,
		},
		{
			name:        "terraform may migrate off a User-Agent ID",
			old:         ManagerProperties{Kind: ManagerKindTerraform, Identity: userAgentID},
			proposed:    ManagerProperties{Kind: ManagerKindTerraform, Identity: "grafana-terraform-provider"},
			hasOld:      true,
			hasProposed: true,
		},
		{
			name:        "terraform may move between User-Agent IDs",
			old:         ManagerProperties{Kind: ManagerKindTerraform, Identity: userAgentID},
			proposed:    ManagerProperties{Kind: ManagerKindTerraform, Identity: otherUserAgentID},
			hasOld:      true,
			hasProposed: true,
		},
		{
			name:        "terraform may not revert to a User-Agent ID",
			old:         ManagerProperties{Kind: ManagerKindTerraform, Identity: "grafana-terraform-provider"},
			proposed:    ManagerProperties{Kind: ManagerKindTerraform, Identity: userAgentID},
			hasOld:      true,
			hasProposed: true,
			wantErr:     "back to User-Agent format",
		},
		{
			name:        "a stable terraform ID is immutable",
			old:         ManagerProperties{Kind: ManagerKindTerraform, Identity: "grafana-terraform-provider"},
			proposed:    ManagerProperties{Kind: ManagerKindTerraform, Identity: "my-terraform-provider"},
			hasOld:      true,
			hasProposed: true,
			wantErr:     "stable custom IDs are immutable",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := CheckManagerPropertiesOnUpdate(tt.old, tt.proposed, tt.hasOld, tt.hasProposed)
			if tt.wantErr != "" {
				require.ErrorContains(t, err, tt.wantErr)
				require.True(t, apierrors.IsForbidden(err), "expected a forbidden response: %v", err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestCheckSameRepoManager(t *testing.T) {
	accessor := func(manager *ManagerProperties) GrafanaMetaAccessor {
		t.Helper()
		meta, err := MetaAccessor(&unstructured.Unstructured{Object: map[string]any{}})
		require.NoError(t, err)
		if manager != nil {
			meta.SetManagerProperties(*manager)
		}
		return meta
	}
	repo := ManagerProperties{Kind: ManagerKindRepo, Identity: "my-repo"}
	terraform := ManagerProperties{Kind: ManagerKindTerraform, Identity: "terraform-provider"}

	tests := []struct {
		name      string
		folder    *ManagerProperties
		resource  *ManagerProperties
		forbidden bool
	}{
		{name: "unmanaged folder imposes nothing", resource: &terraform},
		{name: "a non-repo folder imposes nothing", folder: &terraform, resource: nil},
		{name: "matching repo", folder: &repo, resource: &repo},
		{name: "unmanaged resource in a repo folder", folder: &repo, resource: nil, forbidden: true},
		{
			name:      "resource managed by another repo",
			folder:    &repo,
			resource:  &ManagerProperties{Kind: ManagerKindRepo, Identity: "other-repo"},
			forbidden: true,
		},
		{name: "resource managed by another kind", folder: &repo, resource: &terraform, forbidden: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := CheckSameRepoManager(accessor(tt.folder), accessor(tt.resource))
			if tt.forbidden {
				require.True(t, apierrors.IsForbidden(err), "expected a forbidden response: %v", err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestIsTerraformUserAgentID(t *testing.T) {
	require.True(t, IsTerraformUserAgentID(
		"Terraform/1.5.0 (+https://www.terraform.io) terraform-provider-grafana/v3.0.0"))
	require.False(t, IsTerraformUserAgentID("grafana-terraform-provider"))
	require.False(t, IsTerraformUserAgentID(""))
}
