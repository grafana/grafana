package user

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/auth/authorizer/storewrapper"
)

const testNamespace = "default"

type fakeUserStorage struct {
	storewrapper.K8sStorage
	calls *[]string
	err   error
}

func (f *fakeUserStorage) Delete(_ context.Context, name string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	*f.calls = append(*f.calls, "user:"+name)
	if f.err != nil {
		return nil, false, f.err
	}
	return &iamv0.User{ObjectMeta: metav1.ObjectMeta{Name: name}}, true, nil
}

type fakeAuthInfoStorage struct {
	rest.Lister
	calls     *[]string
	items     []iamv0.AuthInfo
	listErr   error
	deleteErr map[string]error

	listSelector string
	isService    bool
}

func (f *fakeAuthInfoStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	f.listSelector = options.FieldSelector.String()
	f.isService = identity.IsServiceIdentity(ctx)
	if f.listErr != nil {
		return nil, f.listErr
	}
	return &iamv0.AuthInfoList{Items: f.items}, nil
}

func (f *fakeAuthInfoStorage) Delete(_ context.Context, name string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	*f.calls = append(*f.calls, "authinfo:"+name)
	if err := f.deleteErr[name]; err != nil {
		return nil, false, err
	}
	return nil, true, nil
}

func authInfo(name string) iamv0.AuthInfo {
	return iamv0.AuthInfo{ObjectMeta: metav1.ObjectMeta{Name: name, Namespace: testNamespace}}
}

func TestCascadeDeleter_Delete(t *testing.T) {
	ctx := request.WithNamespace(context.Background(), testNamespace)
	notFound := apierrors.NewNotFound(iamv0.AuthInfoResourceInfo.GroupResource(), "ldap-1")

	t.Run("deletes the user's auth infos before the user", func(t *testing.T) {
		var calls []string
		authInfos := &fakeAuthInfoStorage{calls: &calls, items: []iamv0.AuthInfo{authInfo("ldap-1"), authInfo("oauth-1")}}
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls}, authInfos)

		_, deleted, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.NoError(t, err)
		assert.True(t, deleted)
		assert.Equal(t, []string{"authinfo:ldap-1", "authinfo:oauth-1", "user:u1"}, calls)
		assert.Equal(t, "spec.userRef.name=u1", authInfos.listSelector)
		assert.True(t, authInfos.isService, "cascade must not depend on the caller's AuthInfo permissions")
	})

	t.Run("ignores auth infos that are already gone", func(t *testing.T) {
		var calls []string
		authInfos := &fakeAuthInfoStorage{
			calls:     &calls,
			items:     []iamv0.AuthInfo{authInfo("ldap-1")},
			deleteErr: map[string]error{"ldap-1": notFound},
		}
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls}, authInfos)

		_, _, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.NoError(t, err)
		assert.Equal(t, []string{"authinfo:ldap-1", "user:u1"}, calls)
	})

	t.Run("keeps the user when an auth info delete fails", func(t *testing.T) {
		var calls []string
		authInfos := &fakeAuthInfoStorage{
			calls:     &calls,
			items:     []iamv0.AuthInfo{authInfo("ldap-1")},
			deleteErr: map[string]error{"ldap-1": errors.New("boom")},
		}
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls}, authInfos)

		_, _, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.ErrorContains(t, err, "boom")
		assert.Equal(t, []string{"authinfo:ldap-1"}, calls)
	})

	t.Run("keeps the user when listing auth infos fails", func(t *testing.T) {
		var calls []string
		authInfos := &fakeAuthInfoStorage{calls: &calls, listErr: errors.New("boom")}
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls}, authInfos)

		_, _, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.ErrorContains(t, err, "boom")
		assert.Empty(t, calls)
	})

	t.Run("skips the cascade on dry run", func(t *testing.T) {
		var calls []string
		authInfos := &fakeAuthInfoStorage{calls: &calls, items: []iamv0.AuthInfo{authInfo("ldap-1")}}
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls}, authInfos)

		_, _, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{DryRun: []string{metav1.DryRunAll}})

		require.NoError(t, err)
		assert.Equal(t, []string{"user:u1"}, calls)
	})

	t.Run("passes through without auth info storage", func(t *testing.T) {
		var calls []string
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls}, nil)

		_, _, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.NoError(t, err)
		assert.Equal(t, []string{"user:u1"}, calls)
	})

	t.Run("returns the user delete error", func(t *testing.T) {
		var calls []string
		authInfos := &fakeAuthInfoStorage{calls: &calls}
		c := NewCascadeDeleter(&fakeUserStorage{calls: &calls, err: notFound}, authInfos)

		_, _, err := c.Delete(ctx, "u1", nil, &metav1.DeleteOptions{})

		require.True(t, apierrors.IsNotFound(err))
	})
}
