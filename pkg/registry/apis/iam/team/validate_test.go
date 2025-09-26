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
