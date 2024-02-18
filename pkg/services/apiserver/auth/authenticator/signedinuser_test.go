package authenticator

import (
	"context"
	"net/http"
	"testing"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/request/union"
)

func TestSignedInUser(t *testing.T) {
	t.Run("should call next authenticator if SignedInUser is not set", func(t *testing.T) {
		req, err := http.NewRequest("GET", "http://localhost:3000/apis", nil)
		require.NoError(t, err)
		mockAuthenticator := &mockAuthenticator{}
		all := union.New(authenticator.RequestFunc(signedInUserAuthenticator), mockAuthenticator)
		res, ok, err := all.AuthenticateRequest(req)
		require.NoError(t, err)
		require.False(t, ok)
		require.Nil(t, res)
		require.True(t, mockAuthenticator.called)
	})

	t.Run("should set user and group", func(t *testing.T) {
		u := &user.SignedInUser{
			Login:   "admin",
			UserID:  1,
			UserUID: uuid.New().String(),
			Teams:   []int64{1, 2},
		}
		ctx := appcontext.WithUser(context.Background(), u)
		req, err := http.NewRequest("GET", "http://localhost:3000/apis", nil)
		require.NoError(t, err)
		req = req.WithContext(ctx)
		mockAuthenticator := &mockAuthenticator{}
		all := union.New(authenticator.RequestFunc(signedInUserAuthenticator), mockAuthenticator)
		res, ok, err := all.AuthenticateRequest(req)
		require.NoError(t, err)
		require.True(t, ok)
		require.False(t, mockAuthenticator.called)

		require.Equal(t, u.Login, res.User.GetName())
		require.Equal(t, u.UserUID, res.User.GetUID())
		require.Equal(t, []string{"1", "2"}, res.User.GetGroups())
		require.Empty(t, res.User.GetExtra()["id-token"])
	})

	t.Run("should set ID token when available", func(t *testing.T) {
		u := &user.SignedInUser{
			Login:   "admin",
			UserID:  1,
			UserUID: uuid.New().String(),
			Teams:   []int64{1, 2},
			IDToken: "test-id-token",
		}
		ctx := appcontext.WithUser(context.Background(), u)
		req, err := http.NewRequest("GET", "http://localhost:3000/apis", nil)
		require.NoError(t, err)
		req = req.WithContext(ctx)
		mockAuthenticator := &mockAuthenticator{}
		all := union.New(authenticator.RequestFunc(signedInUserAuthenticator), mockAuthenticator)
		res, ok, err := all.AuthenticateRequest(req)
		require.NoError(t, err)
		require.True(t, ok)

		require.False(t, mockAuthenticator.called)
		require.Equal(t, u.Login, res.User.GetName())
		require.Equal(t, u.UserUID, res.User.GetUID())
		require.Equal(t, []string{"1", "2"}, res.User.GetGroups())
		require.Equal(t, "test-id-token", res.User.GetExtra()["id-token"][0])
	})
}

var _ authenticator.Request = (*mockAuthenticator)(nil)

type mockAuthenticator struct {
	called bool
}

func (a *mockAuthenticator) AuthenticateRequest(req *http.Request) (*authenticator.Response, bool, error) {
	a.called = true
	return nil, false, nil
}
