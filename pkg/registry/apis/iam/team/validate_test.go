package team

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
)

func TestValidateOnCreate(t *testing.T) {
	tests := []struct {
		name      string
		requester *identity.StaticRequester
		obj       *iamv0alpha1.Team
		want      error
	}{
		{
			name: "valid team - not provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "test",
					Email: "test@test.com",
				},
			},
			want: nil,
		},
		{
			name: "valid team - provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeServiceAccount,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "test",
					Email:       "test@test.com",
					Provisioned: true,
					ExternalUID: "test-uid",
				},
			},
			want: nil,
		},
		{
			name: "invalid team - no title",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "",
					Email: "test@test.com",
				},
			},
			want: apierrors.NewBadRequest("the team must have a title"),
		},
		{
			name: "invalid team - it's provisioned but the requester is not a service account",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "test",
					Email:       "test@test.com",
					Provisioned: true,
					ExternalUID: "test-uid",
				},
			},
			want: apierrors.NewBadRequest("provisioned teams are only allowed for service accounts"),
		},
		{
			name: "invalid team - has externalUID but it's not provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "test",
					Email:       "test@test.com",
					ExternalUID: "test-uid",
				},
			},
			want: apierrors.NewBadRequest("externalUID is only allowed for provisioned teams"),
		},
		{
			name:      "invalid team - no requester in context",
			requester: nil,
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "test",
					Email: "test@test.com",
				},
			},
			want: apierrors.NewUnauthorized("no identity found"),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ctx := identity.WithRequester(context.Background(), test.requester)
			err := ValidateOnCreate(ctx, test.obj, legacy.NoopExternalGroupReconciler{})
			assert.Equal(t, test.want, err)
		})
	}
}

func TestValidateOnUpdate(t *testing.T) {
	tests := []struct {
		name      string
		requester *identity.StaticRequester
		obj       *iamv0alpha1.Team
		old       *iamv0alpha1.Team
		want      error
	}{
		{
			name: "valid update - no changes to provisioned status",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "updated title",
					Email: "updated@test.com",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "original title",
					Email: "original@test.com",
				},
			},
			want: nil,
		},
		{
			name: "valid update - service account changing to provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeServiceAccount,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "updated title",
					Email:       "updated@test.com",
					Provisioned: true,
					ExternalUID: "test-uid",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "original title",
					Email: "original@test.com",
				},
			},
			want: nil,
		},
		{
			name: "valid update - already provisioned team",
			requester: &identity.StaticRequester{
				Type:    types.TypeServiceAccount,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "updated title",
					Email:       "updated@test.com",
					Provisioned: true,
					ExternalUID: "updated-uid",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "original title",
					Email:       "original@test.com",
					Provisioned: true,
					ExternalUID: "original-uid",
				},
			},
			want: nil,
		},
		{
			name: "invalid update - no title",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "",
					Email: "updated@test.com",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "original title",
					Email: "original@test.com",
				},
			},
			want: apierrors.NewBadRequest("the team must have a title"),
		},
		{
			name: "invalid update - user trying to change to provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "updated title",
					Email:       "updated@test.com",
					Provisioned: true,
					ExternalUID: "test-uid",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "original title",
					Email: "original@test.com",
				},
			},
			want: apierrors.NewBadRequest("provisioned teams are only allowed for service accounts"),
		},
		{
			name: "invalid update - changing from provisioned to non-provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeServiceAccount,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "updated title",
					Email: "updated@test.com",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "original title",
					Email:       "original@test.com",
					Provisioned: true,
					ExternalUID: "original-uid",
				},
			},
			want: apierrors.NewBadRequest("provisioned teams cannot be updated to non-provisioned teams"),
		},
		{
			name: "invalid update - has externalUID but not provisioned",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "updated title",
					Email:       "updated@test.com",
					ExternalUID: "test-uid",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "original title",
					Email: "original@test.com",
				},
			},
			want: apierrors.NewBadRequest("externalUID is only allowed for provisioned teams"),
		},
		{
			name:      "invalid update - no requester in context",
			requester: nil,
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "updated title",
					Email: "updated@test.com",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title: "original title",
					Email: "original@test.com",
				},
			},
			want: apierrors.NewUnauthorized("no identity found"),
		},
		{
			name: "valid update - adding externalUID to provisioned team",
			requester: &identity.StaticRequester{
				Type:    types.TypeServiceAccount,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "updated title",
					Email:       "updated@test.com",
					Provisioned: true,
					ExternalUID: "new-uid",
				},
			},
			old: &iamv0alpha1.Team{
				Spec: iamv0alpha1.TeamSpec{
					Title:       "original title",
					Email:       "original@test.com",
					Provisioned: true,
				},
			},
			want: nil,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ctx := identity.WithRequester(context.Background(), test.requester)
			err := ValidateOnUpdate(ctx, test.obj, test.old, legacy.NoopExternalGroupReconciler{})
			assert.Equal(t, test.want, err)
		})
	}
}

func TestValidateExternalGroups(t *testing.T) {
	t.Run("nil and empty pass through to reconciler.Validate", func(t *testing.T) {
		stub := &stubReconciler{}
		require.NoError(t, validateExternalGroups(nil, stub))
		assert.Nil(t, stub.gotInput)

		stub = &stubReconciler{}
		require.NoError(t, validateExternalGroups([]string{}, stub))
		assert.Empty(t, stub.gotInput)
	})

	t.Run("rejects empty entry", func(t *testing.T) {
		err := validateExternalGroups([]string{"foo", ""}, legacy.NoopExternalGroupReconciler{})
		require.Error(t, err)
		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		assert.Equal(t, int32(400), statusErr.ErrStatus.Code)
		assert.Contains(t, statusErr.ErrStatus.Message, "non-empty")
	})

	t.Run("rejects whitespace-only entry", func(t *testing.T) {
		err := validateExternalGroups([]string{"   "}, legacy.NoopExternalGroupReconciler{})
		require.Error(t, err)
		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		assert.Equal(t, int32(400), statusErr.ErrStatus.Code)
	})

	t.Run("rejects duplicates after normalization", func(t *testing.T) {
		err := validateExternalGroups([]string{"LDAP-Admins", "ldap-admins"}, legacy.NoopExternalGroupReconciler{})
		require.Error(t, err)
		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		assert.Equal(t, int32(400), statusErr.ErrStatus.Code)
		assert.Contains(t, statusErr.ErrStatus.Message, "duplicate")
	})

	t.Run("delegates implementation-specific checks to the reconciler", func(t *testing.T) {
		boom := errors.New("over length")
		stub := &stubReconciler{err: boom}
		err := validateExternalGroups([]string{"LDAP-Admins"}, stub)
		require.ErrorIs(t, err, boom)
		assert.Equal(t, []string{"LDAP-Admins"}, stub.gotInput,
			"validateExternalGroups must pass groups through to reconciler.Validate without mutating")
	})
}

type stubReconciler struct {
	legacy.NoopExternalGroupReconciler
	err      error
	gotInput []string
}

func (s *stubReconciler) Validate(groups []string) error {
	s.gotInput = groups
	return s.err
}
