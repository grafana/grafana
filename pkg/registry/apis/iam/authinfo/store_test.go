package authinfo

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfotest"
	"github.com/grafana/grafana/pkg/services/user"
)

type identitiesFake struct {
	legacy.LegacyIdentityStore
	users map[string]int64 // userUID -> internal ID
}

func (f *identitiesFake) GetUserInternalID(_ context.Context, _ claims.NamespaceInfo, query legacy.GetUserInternalIDQuery) (*legacy.GetUserInternalIDResult, error) {
	id, ok := f.users[query.UID]
	if !ok {
		return nil, user.ErrUserNotFound
	}
	return &legacy.GetUserInternalIDResult{ID: id}, nil
}

func testCtx() context.Context {
	return genericapirequest.WithNamespace(context.Background(), "default")
}

func TestEncodeName(t *testing.T) {
	tests := []struct {
		userUID    string
		authModule string
		want       string
	}{
		{"abc123", "ldap", "abc123.ldap"},
		{"abc123", "oauth_github", "abc123.oauth-github"},
		{"abc123", "auth.saml", "abc123.auth.saml"},
	}
	for _, tt := range tests {
		require.Equal(t, tt.want, encodeName(tt.userUID, tt.authModule))

		userUID, authModule, ok := decodeName(tt.want)
		require.True(t, ok)
		require.Equal(t, tt.userUID, userUID)
		require.Equal(t, tt.authModule, authModule)
	}

	t.Run("no separator", func(t *testing.T) {
		_, _, ok := decodeName("no-dot-in-this-name")
		require.False(t, ok)
	})
}

func TestLegacyStore_Get(t *testing.T) {
	identities := &identitiesFake{users: map[string]int64{"user-uid": 1}}
	created := time.Unix(1000, 0).UTC()

	t.Run("returns the object for a known user and module", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "gh-123", Created: created}, nil)

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"))

		obj, err := store.Get(testCtx(), "user-uid.oauth-github", nil)
		require.NoError(t, err)

		authInfo, ok := obj.(*iamv0alpha1.AuthInfo)
		require.True(t, ok)
		require.Equal(t, "user-uid.oauth-github", authInfo.Name)
		require.Equal(t, "user-uid", authInfo.Spec.UserRef.Name)
		require.Equal(t, "oauth_github", authInfo.Spec.AuthModule)
		require.Equal(t, "gh-123", authInfo.Spec.AuthID)
	})

	t.Run("not found when the user doesn't exist", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"))

		_, err := store.Get(testCtx(), "no-such-user.ldap", nil)
		require.Error(t, err)
		require.True(t, apierrors.IsNotFound(err))
	})

	t.Run("not found when the user has no such module", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(nil, user.ErrUserNotFound)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"))

		_, err := store.Get(testCtx(), "user-uid.oauth-github", nil)
		require.Error(t, err)
		require.True(t, apierrors.IsNotFound(err))
	})

	t.Run("not found for a name with no separator", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"))

		_, err := store.Get(testCtx(), "no-dot-in-this-name", nil)
		require.Error(t, err)
		require.True(t, apierrors.IsNotFound(err))
	})
}

func TestLegacyStore_Create(t *testing.T) {
	identities := &identitiesFake{users: map[string]int64{"user-uid": 1}}
	created := time.Unix(1000, 0).UTC()

	newObj := func() *iamv0alpha1.AuthInfo {
		return &iamv0alpha1.AuthInfo{
			Spec: iamv0alpha1.AuthInfoSpec{
				UserRef:    iamv0alpha1.AuthInfoUserRef{Name: "user-uid"},
				AuthModule: "oauth_github",
				AuthID:     "gh-123",
			},
		}
	}

	t.Run("creates a new auth info object", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(nil, user.ErrUserNotFound).Once()
		authInfoStore.On("SetAuthInfo", mock.Anything, &login.SetAuthInfoCommand{
			AuthModule: "oauth_github",
			AuthId:     "gh-123",
			UserId:     1,
			UserUID:    "user-uid",
		}).Return(nil)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "gh-123", Created: created}, nil).Once()

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"))

		obj, err := store.Create(testCtx(), newObj(), nil, &metav1.CreateOptions{})
		require.NoError(t, err)

		authInfo, ok := obj.(*iamv0alpha1.AuthInfo)
		require.True(t, ok)
		require.Equal(t, "user-uid.oauth-github", authInfo.Name)
	})

	t.Run("conflict when the (user, module) pair already exists", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(&login.UserAuth{UserId: 1, AuthModule: "oauth_github"}, nil)

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"))

		_, err := store.Create(testCtx(), newObj(), nil, &metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsAlreadyExists(err))
	})

	t.Run("bad request when the referenced user doesn't exist", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"))

		obj := newObj()
		obj.Spec.UserRef.Name = "no-such-user"
		_, err := store.Create(testCtx(), obj, nil, &metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsBadRequest(err))
	})

	t.Run("bad request when metadata.name doesn't match the deterministic name", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"))

		obj := newObj()
		obj.Name = "something-else"
		_, err := store.Create(testCtx(), obj, nil, &metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsBadRequest(err))
	})
}

func TestLegacyStore_Update(t *testing.T) {
	identities := &identitiesFake{users: map[string]int64{"user-uid": 1}}
	created := time.Unix(1000, 0).UTC()

	t.Run("updates authID and externalUID", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "gh-123", Created: created}, nil).Once()
		authInfoStore.On("UpdateAuthInfo", mock.Anything, &login.UpdateAuthInfoCommand{
			AuthModule:  "oauth_github",
			AuthId:      "gh-456",
			UserId:      1,
			ExternalUID: "ext-1",
		}).Return(nil)
		updatedRow := &login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "gh-456", ExternalUID: "ext-1", Created: created}
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(updatedRow, nil).Once()

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"))

		externalUID := "ext-1"
		newObj := &iamv0alpha1.AuthInfo{
			ObjectMeta: metav1.ObjectMeta{Name: "user-uid.oauth-github", Namespace: "default"},
			Spec: iamv0alpha1.AuthInfoSpec{
				UserRef:     iamv0alpha1.AuthInfoUserRef{Name: "user-uid"},
				AuthModule:  "oauth_github",
				AuthID:      "gh-456",
				ExternalUID: &externalUID,
			},
		}

		obj, created, err := store.Update(testCtx(), "user-uid.oauth-github", rest.DefaultUpdatedObjectInfo(newObj), nil, nil, false, &metav1.UpdateOptions{})
		require.NoError(t, err)
		require.False(t, created)

		authInfo, ok := obj.(*iamv0alpha1.AuthInfo)
		require.True(t, ok)
		require.Equal(t, "gh-456", authInfo.Spec.AuthID)
		require.Equal(t, "ext-1", *authInfo.Spec.ExternalUID)
	})

	t.Run("rejects changing the identifying fields", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "gh-123", Created: created}, nil)

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"))

		newObj := &iamv0alpha1.AuthInfo{
			ObjectMeta: metav1.ObjectMeta{Name: "user-uid.oauth-github", Namespace: "default"},
			Spec: iamv0alpha1.AuthInfoSpec{
				UserRef:    iamv0alpha1.AuthInfoUserRef{Name: "other-user"},
				AuthModule: "oauth_github",
				AuthID:     "gh-123",
			},
		}

		_, _, err := store.Update(testCtx(), "user-uid.oauth-github", rest.DefaultUpdatedObjectInfo(newObj), nil, nil, false, &metav1.UpdateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsBadRequest(err))
	})
}

func TestLegacyStore_List(t *testing.T) {
	identities := &identitiesFake{users: map[string]int64{"user-uid": 1}}
	created := time.Unix(1000, 0).UTC()

	t.Run("requires the userRef.name field selector", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"))

		_, err := store.List(testCtx(), &internalversion.ListOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsBadRequest(err))
	})

	t.Run("lists every module for the selected user", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetUserAuthModules", mock.Anything, int64(1)).Return([]string{"ldap", "oauth_github"}, nil)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "ldap"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "ldap", AuthId: "cn=user", Created: created}, nil)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "gh-123", Created: created}, nil)

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"))

		obj, err := store.List(testCtx(), &internalversion.ListOptions{
			FieldSelector: fields.OneTermEqualSelector("spec.userRef.name", "user-uid"),
		})
		require.NoError(t, err)

		list, ok := obj.(*iamv0alpha1.AuthInfoList)
		require.True(t, ok)
		require.Len(t, list.Items, 2)
	})

	t.Run("returns an empty list when the user doesn't exist", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"))

		obj, err := store.List(testCtx(), &internalversion.ListOptions{
			FieldSelector: fields.OneTermEqualSelector("spec.userRef.name", "no-such-user"),
		})
		require.NoError(t, err)

		list, ok := obj.(*iamv0alpha1.AuthInfoList)
		require.True(t, ok)
		require.Empty(t, list.Items)
	})
}
