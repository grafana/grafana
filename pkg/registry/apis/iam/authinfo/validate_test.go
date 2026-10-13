package authinfo

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

type fakeGetter struct {
	err error
}

func (f fakeGetter) Get(_ context.Context, _ string, _ *metav1.GetOptions) (runtime.Object, error) {
	return nil, f.err
}

func TestValidateOnCreate(t *testing.T) {
	obj := &iamv0alpha1.AuthInfo{
		Spec: iamv0alpha1.AuthInfoSpec{
			UserRef:    iamv0alpha1.AuthInfoUserRef{Name: "user-1"},
			AuthModule: "ldap",
			AuthID:     "cn=test",
		},
	}
	adminCtx := identity.WithRequester(context.Background(), &identity.StaticRequester{Type: types.TypeUser, OrgRole: identity.RoleAdmin})
	someErr := errors.New("boom")

	tests := []struct {
		name       string
		ctx        context.Context
		userGetter rest.Getter
		check      func(t *testing.T, err error)
	}{
		{
			name:       "user exists",
			ctx:        adminCtx,
			userGetter: fakeGetter{},
			check:      func(t *testing.T, err error) { require.NoError(t, err) },
		},
		{
			name:       "user not found is a bad request",
			ctx:        adminCtx,
			userGetter: fakeGetter{err: apierrors.NewNotFound(schema.GroupResource{Resource: "users"}, "user-1")},
			check: func(t *testing.T, err error) {
				require.True(t, apierrors.IsBadRequest(err), "got %v", err)
			},
		},
		{
			name:       "other lookup errors are propagated",
			ctx:        adminCtx,
			userGetter: fakeGetter{err: someErr},
			check:      func(t *testing.T, err error) { require.ErrorIs(t, err, someErr) },
		},
		{
			name:       "no getter fails closed",
			ctx:        adminCtx,
			userGetter: nil,
			check: func(t *testing.T, err error) {
				require.True(t, apierrors.IsInternalError(err), "got %v", err)
			},
		},
		{
			name:       "no identity is unauthorized",
			ctx:        context.Background(),
			userGetter: fakeGetter{},
			check: func(t *testing.T, err error) {
				require.True(t, apierrors.IsUnauthorized(err), "got %v", err)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tt.check(t, ValidateOnCreate(tt.ctx, obj, tt.userGetter))
		})
	}
}

func TestValidateOnUpdate(t *testing.T) {
	newObj := func(user, module, authID string) *iamv0alpha1.AuthInfo {
		return &iamv0alpha1.AuthInfo{
			Spec: iamv0alpha1.AuthInfoSpec{
				UserRef:    iamv0alpha1.AuthInfoUserRef{Name: user},
				AuthModule: module,
				AuthID:     authID,
			},
		}
	}
	adminCtx := identity.WithRequester(context.Background(), &identity.StaticRequester{Type: types.TypeUser, OrgRole: identity.RoleAdmin})
	old := newObj("user-1", "ldap", "cn=old")

	t.Run("authID can change", func(t *testing.T) {
		require.NoError(t, ValidateOnUpdate(adminCtx, newObj("user-1", "ldap", "cn=new"), old))
	})

	t.Run("userRef is immutable", func(t *testing.T) {
		err := ValidateOnUpdate(adminCtx, newObj("user-2", "ldap", "cn=old"), old)
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
		require.Contains(t, err.Error(), "immutable")
	})

	t.Run("authModule is immutable", func(t *testing.T) {
		err := ValidateOnUpdate(adminCtx, newObj("user-1", "oauth_github", "cn=old"), old)
		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
		require.Contains(t, err.Error(), "immutable")
	})

	t.Run("no identity is unauthorized", func(t *testing.T) {
		err := ValidateOnUpdate(context.Background(), newObj("user-1", "ldap", "cn=new"), old)
		require.True(t, apierrors.IsUnauthorized(err), "got %v", err)
	})
}
