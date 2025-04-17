package authenticator

import (
	"context"
	"net/http"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authentication/authenticator"
)

func TestAuthenticator(t *testing.T) {
	t.Run("should call next authenticator if identity is not set in context", func(t *testing.T) {
		req, err := http.NewRequest("GET", "http://localhost:3000/apis", nil)
		require.NoError(t, err)
		mockAuthenticator := &mockAuthenticator{}

		auth := NewAuthenticator(mockAuthenticator)
		res, ok, err := auth.AuthenticateRequest(req)
		require.NoError(t, err)
		require.False(t, ok)
		require.Nil(t, res)
		require.True(t, mockAuthenticator.called)
	})

	t.Run("should authenticate when identity is set in context", func(t *testing.T) {
		req, err := http.NewRequest("GET", "http://localhost:3000/apis", nil)
		require.NoError(t, err)

		ident := &user.SignedInUser{
			Name:    "admin",
			UserID:  1,
			UserUID: "xyz",
			Teams:   []int64{1, 2},
		}

		req = req.WithContext(identity.WithRequester(context.Background(), ident))
		mockAuthenticator := &mockAuthenticator{}
		auth := NewAuthenticator(mockAuthenticator)
		res, ok, err := auth.AuthenticateRequest(req)
		require.NoError(t, err)
		require.True(t, ok)
		require.False(t, mockAuthenticator.called)

		require.Equal(t, ident.GetName(), res.User.GetName())
		require.Equal(t, ident.GetUID(), res.User.GetUID())
		require.Equal(t, []string{"1", "2"}, res.User.GetGroups())
		require.Empty(t, res.User.GetExtra()["id-token"])
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
