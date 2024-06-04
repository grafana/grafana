package gcomsso

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestGComSSOService_LogoutHook(t *testing.T) {
	cfg := &setting.Cfg{
		GrafanaComURL:         "http://example.com",
		GrafanaComSSOAPIToken: "sso-api-token",
	}

	s := ProvideGComSSOService(cfg)

	t.Run("Successfully logs out from grafana.com", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			require.Equal(t, http.MethodPost, r.Method)
			require.Equal(t, "/api/logout/grafana/sso", r.URL.Path)

			require.Equal(t, "application/json", r.Header.Get("Content-Type"))
			require.Equal(t, "Bearer "+cfg.GrafanaComSSOAPIToken, r.Header.Get("Authorization"))

			w.WriteHeader(http.StatusNoContent)
		}))
		defer server.Close()

		cfg.GrafanaComURL = server.URL
		user := &user.SignedInUser{
			IDToken: "id-token",
		}
		sessionToken := &usertoken.UserToken{
			Id: 123,
		}

		err := s.LogoutHook(context.Background(), user, sessionToken)
		require.NoError(t, err)
	})

	t.Run("Fails to log out from grafana.com", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}))
		defer server.Close()

		cfg.GrafanaComURL = server.URL
		user := &user.SignedInUser{
			IDToken: "id-token",
		}
		sessionToken := &usertoken.UserToken{
			Id: 123,
		}

		err := s.LogoutHook(context.Background(), user, sessionToken)
		require.Error(t, err)
	})
}
