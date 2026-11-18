package authnimpl

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/personalaccesstokens/patstore"
)

type fakeOAuthSvc struct {
	oauthtoken.OAuthTokenService
	hook oauthtoken.RefreshFailureHook
}

func (f *fakeOAuthSvc) RegisterRefreshFailureHook(h oauthtoken.RefreshFailureHook) { f.hook = h }

type fakeLogoutAuthn struct {
	authn.Service
	hook authn.PreLogoutHookFn
}

func (f *fakeLogoutAuthn) RegisterPreLogoutHook(h authn.PreLogoutHookFn, _ uint) { f.hook = h }

type fakePATStore struct {
	patstore.Store
	revoked map[int64]string
}

func (f *fakePATStore) RevokeAllForUser(_ context.Context, userID int64, reason string) (int64, error) {
	f.revoked[userID] = reason
	return 1, nil
}

func TestPersonalTokenIdPBinding(t *testing.T) {
	oauthUser := func(module string) identity.Requester {
		return &authn.Identity{ID: "7", Type: types.TypeUser, AuthenticatedBy: module}
	}

	t.Run("refresh failure revokes the user's tokens", func(t *testing.T) {
		store := &fakePATStore{revoked: map[int64]string{}}
		oauth := &fakeOAuthSvc{}
		registerPersonalTokenIdPBinding(log.NewNopLogger(), oauth, &fakeLogoutAuthn{}, store, false)
		require.NotNil(t, oauth.hook)

		oauth.hook(context.Background(), oauthUser("oauth_generic_oauth"), "oauth_generic_oauth")
		require.Equal(t, patstore.ReasonIDPRevoked, store.revoked[7])
	})

	t.Run("logout revokes only OAuth users and only when enabled", func(t *testing.T) {
		store := &fakePATStore{revoked: map[int64]string{}}
		a := &fakeLogoutAuthn{}
		registerPersonalTokenIdPBinding(log.NewNopLogger(), &fakeOAuthSvc{}, a, store, true)
		require.NotNil(t, a.hook)

		require.NoError(t, a.hook(context.Background(), oauthUser("password"), (*auth.UserToken)(nil)))
		require.Empty(t, store.revoked)
		require.NoError(t, a.hook(context.Background(), oauthUser("oauth_okta"), (*auth.UserToken)(nil)))
		require.Equal(t, patstore.ReasonIDPRevoked, store.revoked[7])

		off := &fakeLogoutAuthn{}
		registerPersonalTokenIdPBinding(log.NewNopLogger(), &fakeOAuthSvc{}, off, store, false)
		require.Nil(t, off.hook)
	})
}
