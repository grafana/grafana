package teambinding

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
			err := ValidateOnCreate(ctx, test.obj)
			assert.Equal(t, test.want, err)
		})
	}
}
