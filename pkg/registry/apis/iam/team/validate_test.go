package team

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
			err := ValidateOnCreate(ctx, test.obj)
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
			err := ValidateOnUpdate(ctx, test.obj, test.old)
			assert.Equal(t, test.want, err)
		})
	}
}

func TestValidateOnBindingCreate(t *testing.T) {
	tests := []struct {
		name      string
		requester *identity.StaticRequester
		obj       *iamv0alpha1.TeamBinding
		want      error
	}{
		{
			name: "valid team binding create",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
				},
			},
			want: nil,
		},
		{
			name: "invalid team binding - invalid permission",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: "invalid",
				},
			},
			want: apierrors.NewBadRequest("invalid permission"),
		},
		{
			name: "invalid team binding - no subject",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Name: "",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
				},
			},
			want: apierrors.NewBadRequest("subject is required"),
		},
		{
			name: "invalid team binding - no teamRef",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
				},
			},
			want: apierrors.NewBadRequest("teamRef is required"),
		},
		{
			name:      "invalid team binding - no requester in context",
			requester: nil,
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
				},
			},
			want: apierrors.NewUnauthorized("no identity found"),
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ctx := identity.WithRequester(context.Background(), test.requester)
			err := ValidateOnBindingCreate(ctx, test.obj)
			assert.Equal(t, test.want, err)
		})
	}
}
