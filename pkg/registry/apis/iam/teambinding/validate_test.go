package teambinding

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestValidateOnCreate(t *testing.T) {
	tests := []struct {
		name        string
		requester   *identity.StaticRequester
		obj         *iamv0alpha1.TeamBinding
		teamGetter  rest.Getter
		userGetter  rest.Getter
		want        error
		errContains string
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
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
				},
			},
			teamGetter: foundGetter(),
			userGetter: foundGetter(),
			want:       nil,
		},
		{
			name: "invalid team binding - invalid subject kind",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "ServiceAccount",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
				},
			},
			want: apierrors.NewBadRequest("subject kind must be User"),
		},
		{
			name: "invalid team binding - empty subject kind",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
				},
			},
			want: apierrors.NewBadRequest("subject kind must be User"),
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
						Kind: "User",
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
						Kind: "User",
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
						Kind: "User",
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
						Kind: "User",
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
		{
			name: "invalid team binding - team does not exist",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "nonexistent-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
				},
			},
			teamGetter: notFoundGetter("teams"),
			userGetter: foundGetter(),
			want:       apierrors.NewBadRequest("team does not exist"),
		},
		{
			name: "invalid team binding - user does not exist",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "nonexistent-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionMember,
				},
			},
			teamGetter: foundGetter(),
			userGetter: notFoundGetter("users"),
			want:       apierrors.NewBadRequest("user does not exist"),
		},
		{
			name: "team getter returns unexpected error",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
				},
			},
			teamGetter:  errorGetter(),
			userGetter:  foundGetter(),
			errContains: "internal error",
		},
		{
			name: "service identity skips existence validation",
			requester: &identity.StaticRequester{
				Type:    types.TypeServiceAccount,
				OrgRole: identity.RoleAdmin,
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "nonexistent-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "nonexistent-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
				},
			},
			teamGetter: notFoundGetter("teams"),
			userGetter: notFoundGetter("users"),
			want:       nil,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var ctx context.Context
			if test.requester != nil && test.requester.Type == types.TypeServiceAccount {
				ctx = identity.WithServiceIdentityContext(context.Background(), 1)
			} else {
				ctx = identity.WithRequester(context.Background(), test.requester)
			}
			err := ValidateOnCreate(ctx, test.obj, test.teamGetter, test.userGetter)
			if test.errContains != "" {
				assert.ErrorContains(t, err, test.errContains)
			} else {
				assert.Equal(t, test.want, err)
			}
		})
	}
}

func TestValidateOnUpdate(t *testing.T) {
	tests := []struct {
		name      string
		requester *identity.StaticRequester
		old       *iamv0alpha1.TeamBinding
		obj       *iamv0alpha1.TeamBinding
		want      error
	}{
		{
			name: "valid update - permission change",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			old: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionMember,
					External:   false,
				},
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   false,
				},
			},
			want: nil,
		},
		{
			name: "invalid update - invalid subject kind",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			old: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   false,
				},
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "ServiceAccount",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   false,
				},
			},
			want: apierrors.NewBadRequest("subject kind must be User"),
		},
		{
			name: "valid update - no changes",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			old: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   false,
				},
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   false,
				},
			},
			want: nil,
		},
		{
			name: "invalid update - teamRef change",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			old: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   false,
				},
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team-updated",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   false,
				},
			},
			want: apierrors.NewBadRequest("teamRef is immutable"),
		},
		{
			name: "invalid update - subject change",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			old: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   false,
				},
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user-updated",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   false,
				},
			},
			want: apierrors.NewBadRequest("subject is immutable"),
		},
		{
			name: "invalid update - external change",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			old: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   false,
				},
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   true,
				},
			},
			want: apierrors.NewBadRequest("external is immutable"),
		},
		{
			name: "invalid update - invalid permission",
			requester: &identity.StaticRequester{
				Type:    types.TypeUser,
				OrgRole: identity.RoleAdmin,
			},
			old: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   false,
				},
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
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
			name:      "invalid update - no requester in context",
			requester: nil,
			old: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   false,
				},
			},
			obj: &iamv0alpha1.TeamBinding{
				Spec: iamv0alpha1.TeamBindingSpec{
					Subject: iamv0alpha1.TeamBindingspecSubject{
						Kind: "User",
						Name: "test-user",
					},
					TeamRef: iamv0alpha1.TeamBindingTeamRef{
						Name: "test-team",
					},
					Permission: iamv0alpha1.TeamBindingTeamPermissionAdmin,
					External:   false,
				},
			},
			want: apierrors.NewUnauthorized("no identity found"),
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

type fakeGetter struct {
	obj runtime.Object
	err error
}

func (f *fakeGetter) Get(_ context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
	return f.obj, f.err
}

var _ rest.Getter = (*fakeGetter)(nil)

func foundGetter() rest.Getter {
	return &fakeGetter{obj: &metav1.PartialObjectMetadata{}}
}

func notFoundGetter(resource string) rest.Getter {
	return &fakeGetter{err: apierrors.NewNotFound(schema.GroupResource{Resource: resource}, "not-found")}
}

func errorGetter() rest.Getter {
	return &fakeGetter{err: fmt.Errorf("internal error")}
}
