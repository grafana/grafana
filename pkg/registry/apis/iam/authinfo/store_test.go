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
	"k8s.io/apimachinery/pkg/runtime"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	claims "github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/login/authinfoimpl"
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

func (f *identitiesFake) GetUserUIDByID(_ context.Context, _ claims.NamespaceInfo, query legacy.GetUserUIDByIDQuery) (*legacy.GetUserUIDByIDResult, error) {
	for uid, id := range f.users {
		if id == query.ID {
			return &legacy.GetUserUIDByIDResult{UID: uid}, nil
		}
	}
	return nil, user.ErrUserNotFound
}

func testCtx() context.Context {
	return genericapirequest.WithNamespace(context.Background(), "default")
}

func TestLegacyStore_Get(t *testing.T) {
	identities := &identitiesFake{users: map[string]int64{"user-uid": 1}}
	created := time.Unix(1000, 0).UTC()

	t.Run("returns the object for a known user and module", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "gh-123", Created: created}, nil)

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

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
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

		_, err := store.Get(testCtx(), "no-such-user.ldap", nil)
		require.Error(t, err)
		require.True(t, apierrors.IsNotFound(err))
	})

	t.Run("not found when the user has no such module", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(nil, user.ErrUserNotFound)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

		_, err := store.Get(testCtx(), "user-uid.oauth-github", nil)
		require.Error(t, err)
		require.True(t, apierrors.IsNotFound(err))
	})

	t.Run("not found for a name with no separator", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

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

	t.Run("creates a new auth info object and invalidates its GetAuthInfo cache entries", func(t *testing.T) {
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

		cache := remotecache.NewFakeCacheStorage()
		cacheKeys := []string{
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{AuthModule: "oauth_github", AuthId: "gh-123"}),
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{UserId: 1}),
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}),
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{UserId: 1, AuthId: "gh-123"}),
		}
		for _, key := range cacheKeys {
			require.NoError(t, cache.Set(context.Background(), key, []byte("stale"), 0))
		}

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), cache)

		obj, err := store.Create(testCtx(), newObj(), nil, &metav1.CreateOptions{})
		require.NoError(t, err)

		authInfo, ok := obj.(*iamv0alpha1.AuthInfo)
		require.True(t, ok)
		require.Equal(t, "user-uid.oauth-github", authInfo.Name)

		for _, key := range cacheKeys {
			_, err := cache.Get(context.Background(), key)
			require.ErrorIs(t, err, remotecache.ErrCacheItemNotFound, "cache key %q should have been invalidated", key)
		}
	})

	t.Run("conflict when the (user, module) pair already exists", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(&login.UserAuth{UserId: 1, AuthModule: "oauth_github"}, nil)

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

		_, err := store.Create(testCtx(), newObj(), nil, &metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsAlreadyExists(err))
	})

	t.Run("bad request when the referenced user doesn't exist", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

		obj := newObj()
		obj.Spec.UserRef.Name = "no-such-user"
		_, err := store.Create(testCtx(), obj, nil, &metav1.CreateOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsBadRequest(err))
	})

	t.Run("bad request when metadata.name doesn't match the deterministic name", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

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

	t.Run("updates authID and externalUID, invalidating both old and new GetAuthInfo cache entries", func(t *testing.T) {
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

		cache := remotecache.NewFakeCacheStorage()
		cacheKeys := []string{
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{AuthModule: "oauth_github", AuthId: "gh-456"}), // new AuthID
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{AuthModule: "oauth_github", AuthId: "gh-123"}), // old AuthID
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{UserId: 1}),
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}),
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{UserId: 1, AuthId: "gh-456"}), // new AuthID, no module
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{UserId: 1, AuthId: "gh-123"}), // old AuthID, no module
		}
		for _, key := range cacheKeys {
			require.NoError(t, cache.Set(context.Background(), key, []byte("stale"), 0))
		}

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), cache)

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

		for _, key := range cacheKeys {
			_, err := cache.Get(context.Background(), key)
			require.ErrorIs(t, err, remotecache.ErrCacheItemNotFound, "cache key %q should have been invalidated", key)
		}
	})

	t.Run("rejects changing the identifying fields", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "gh-123", Created: created}, nil)

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

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

	t.Run("requires the userRef.name or authID field selector", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

		_, err := store.List(testCtx(), &internalversion.ListOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsBadRequest(err))
	})

	t.Run("finds by authID alone, without knowing the user", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{AuthId: "gh-123"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "gh-123", Created: created}, nil)

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

		obj, err := store.List(testCtx(), &internalversion.ListOptions{
			FieldSelector: fields.OneTermEqualSelector("spec.authID", "gh-123"),
		})
		require.NoError(t, err)

		list, ok := obj.(*iamv0alpha1.AuthInfoList)
		require.True(t, ok)
		require.Len(t, list.Items, 1)
		require.Equal(t, "user-uid.oauth-github", list.Items[0].Name)
	})

	t.Run("combines authID and authModule filters", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{AuthId: "gh-123", AuthModule: "oauth_github"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "gh-123", Created: created}, nil)

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

		obj, err := store.List(testCtx(), &internalversion.ListOptions{
			FieldSelector: fields.AndSelectors(
				fields.OneTermEqualSelector("spec.authID", "gh-123"),
				fields.OneTermEqualSelector("spec.authModule", "oauth_github"),
			),
		})
		require.NoError(t, err)

		list, ok := obj.(*iamv0alpha1.AuthInfoList)
		require.True(t, ok)
		require.Len(t, list.Items, 1)
	})

	t.Run("returns an empty list when no authinfo matches authID", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{AuthId: "no-such-id"}).
			Return(nil, user.ErrUserNotFound)

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

		obj, err := store.List(testCtx(), &internalversion.ListOptions{
			FieldSelector: fields.OneTermEqualSelector("spec.authID", "no-such-id"),
		})
		require.NoError(t, err)

		list, ok := obj.(*iamv0alpha1.AuthInfoList)
		require.True(t, ok)
		require.Empty(t, list.Items)
	})

	t.Run("returns an empty list, not an error, for a stale or cross-org user_auth row", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		// UserId 999 has no entry in identities.users.
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{AuthId: "orphaned-id"}).
			Return(&login.UserAuth{UserId: 999, AuthModule: "ldap", AuthId: "orphaned-id", Created: created}, nil)

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

		obj, err := store.List(testCtx(), &internalversion.ListOptions{
			FieldSelector: fields.OneTermEqualSelector("spec.authID", "orphaned-id"),
		})
		require.NoError(t, err)

		list, ok := obj.(*iamv0alpha1.AuthInfoList)
		require.True(t, ok)
		require.Empty(t, list.Items)
	})

	t.Run("lists every module for the selected user", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetUserAuthModules", mock.Anything, int64(1)).Return([]string{"ldap", "oauth_github"}, nil)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "ldap"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "ldap", AuthId: "cn=user", Created: created}, nil)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "gh-123", Created: created}, nil)

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

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
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

		obj, err := store.List(testCtx(), &internalversion.ListOptions{
			FieldSelector: fields.OneTermEqualSelector("spec.userRef.name", "no-such-user"),
		})
		require.NoError(t, err)

		list, ok := obj.(*iamv0alpha1.AuthInfoList)
		require.True(t, ok)
		require.Empty(t, list.Items)
	})
}

func TestLegacyStore_Delete(t *testing.T) {
	identities := &identitiesFake{users: map[string]int64{"user-uid": 1}}
	created := time.Unix(1000, 0).UTC()

	t.Run("deletes the named module and invalidates its GetAuthInfo cache entries", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "gh-123", Created: created}, nil)
		authInfoStore.On("DeleteAuthInfo", mock.Anything, &login.DeleteAuthInfoCommand{
			UserAuth: &login.UserAuth{UserId: 1, AuthModule: "oauth_github"},
		}).Return(nil)

		cache := remotecache.NewFakeCacheStorage()
		cacheKeys := []string{
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{AuthModule: "oauth_github", AuthId: "gh-123"}),
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{UserId: 1}),
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}),
			authinfoimpl.AuthInfoCacheKey(&login.GetAuthInfoQuery{UserId: 1, AuthId: "gh-123"}),
		}
		for _, key := range cacheKeys {
			require.NoError(t, cache.Set(context.Background(), key, []byte("stale"), 0))
		}

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), cache)

		obj, immediate, err := store.Delete(testCtx(), "user-uid.oauth-github", nil, &metav1.DeleteOptions{})
		require.NoError(t, err)
		require.True(t, immediate)

		authInfo, ok := obj.(*iamv0alpha1.AuthInfo)
		require.True(t, ok)
		require.Equal(t, "user-uid.oauth-github", authInfo.Name)

		for _, key := range cacheKeys {
			_, err := cache.Get(context.Background(), key)
			require.ErrorIs(t, err, remotecache.ErrCacheItemNotFound, "cache key %q should have been invalidated", key)
		}
	})

	t.Run("not found when the user doesn't exist", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

		_, _, err := store.Delete(testCtx(), "no-such-user.ldap", nil, &metav1.DeleteOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsNotFound(err))
	})

	t.Run("not found when the user has no such module", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(nil, user.ErrUserNotFound)
		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

		_, _, err := store.Delete(testCtx(), "user-uid.oauth-github", nil, &metav1.DeleteOptions{})
		require.Error(t, err)
		require.True(t, apierrors.IsNotFound(err))
	})

	t.Run("propagates a deleteValidation rejection without deleting", func(t *testing.T) {
		authInfoStore := authinfotest.NewMockAuthInfoStore(t)
		authInfoStore.On("GetAuthInfo", mock.Anything, &login.GetAuthInfoQuery{UserId: 1, AuthModule: "oauth_github"}).
			Return(&login.UserAuth{UserId: 1, UserUID: "user-uid", AuthModule: "oauth_github", AuthId: "gh-123", Created: created}, nil)

		store := NewLegacyStore(identities, authInfoStore, noop.NewTracerProvider().Tracer("test"), remotecache.NewFakeCacheStorage())

		wantErr := apierrors.NewBadRequest("rejected")
		_, _, err := store.Delete(testCtx(), "user-uid.oauth-github", func(context.Context, runtime.Object) error {
			return wantErr
		}, &metav1.DeleteOptions{})
		require.ErrorIs(t, err, wantErr)
	})
}
