package authorizer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/authlib/types"
	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

// staticRoleRefResolver returns fixed permissions or an error for tests.
type staticRoleRefResolver struct {
	perms []iamv0.RolespecPermission
	err   error
}

func (s *staticRoleRefResolver) GetPermissionsForRef(_ context.Context, _, _ string) ([]iamv0.RolespecPermission, error) {
	if s.err != nil {
		return nil, s.err
	}
	return s.perms, nil
}

func buildRoleBinding(refs []iamv0.RoleBindingspecRoleRef) *iamv0.RoleBinding {
	return &iamv0.RoleBinding{
		ObjectMeta: metav1.ObjectMeta{Name: "test-rb", Namespace: "default"},
		Spec: iamv0.RoleBindingSpec{
			Subject:  iamv0.RoleBindingspecSubject{Kind: iamv0.RoleBindingSpecSubjectKindUser, Name: "user1"},
			RoleRefs: refs,
		},
	}
}

func TestRoleBindingAuthorizer_RoleNotFound(t *testing.T) {
	resolver := &staticRoleRefResolver{
		err: apierrors.NewNotFound(iamv0.RoleInfo.GroupResource(), "custom-role-1"),
	}
	authz := NewRoleBindingAuthorizer(nil, resolver)

	rb := buildRoleBinding([]iamv0.RoleBindingspecRoleRef{
		{Kind: iamv0.RoleBindingSpecRoleRefKindRole, Name: "custom-role-1"},
	})
	ctx := types.WithAuthInfo(context.Background(), user)
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{Namespace: "org-2"})
	err := authz.BeforeCreate(ctx, rb)
	require.Error(t, err)
	require.True(t, apierrors.IsBadRequest(err))
	require.Contains(t, err.Error(), "role not found")
}

func TestRoleBindingAuthorizer_AllowsWhenUserHasPermissions(t *testing.T) {
	perms := []iamv0.RolespecPermission{{Action: "dashboards:read", Scope: ""}}
	resolver := &staticRoleRefResolver{perms: perms}

	// "dashboards:read" is translated via mapper to K8s format, then accessClient.Check is used.
	accessClient := &fakeAccessClient{
		checkFunc: func(_ types.AuthInfo, _ *types.CheckRequest, _ string) (types.CheckResponse, error) {
			return types.CheckResponse{Allowed: true}, nil
		},
	}
	validator := NewRolePermissionValidator(accessClient, nil)
	authz := NewRoleBindingAuthorizer(validator, resolver)

	rb := buildRoleBinding([]iamv0.RoleBindingspecRoleRef{
		{Kind: iamv0.RoleBindingSpecRoleRefKindRole, Name: "custom-role-1"},
	})
	ctx := types.WithAuthInfo(context.Background(), user)
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{Namespace: "org-2"})
	err := authz.BeforeCreate(ctx, rb)
	require.NoError(t, err)
}

func TestRoleBindingAuthorizer_DeniesWhenUserLacksPermissions(t *testing.T) {
	perms := []iamv0.RolespecPermission{{Action: "dashboards:read", Scope: ""}}
	resolver := &staticRoleRefResolver{perms: perms}

	// "dashboards:read" is translated via mapper to K8s; accessClient denies.
	accessClient := &fakeAccessClient{
		checkFunc: func(_ types.AuthInfo, _ *types.CheckRequest, _ string) (types.CheckResponse, error) {
			return types.CheckResponse{Allowed: false}, nil
		},
	}
	validator := NewRolePermissionValidator(accessClient, nil)
	a := NewRoleBindingAuthorizer(validator, resolver)

	ctx := types.WithAuthInfo(context.Background(), user)
	ctx = identity.WithRequester(ctx, &identity.StaticRequester{Namespace: "org-2"})
	rb := buildRoleBinding([]iamv0.RoleBindingspecRoleRef{
		{Kind: iamv0.RoleBindingSpecRoleRefKindRole, Name: "custom-role"},
	})
	err := a.BeforeCreate(ctx, rb)
	require.Error(t, err)
	assert.True(t, apierrors.IsForbidden(err))
}
