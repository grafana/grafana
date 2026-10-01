package gcomsso

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	oftesting "github.com/open-feature/go-sdk/openfeature/testing"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/models/usertoken"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var provider = oftesting.NewTestProvider()

func TestMain(m *testing.M) {
	if err := openfeature.SetProviderAndWait(provider); err != nil {
		panic(err)
	}
	m.Run()
}

func setCloudRBACRolesFlag(t *testing.T, enabled bool) {
	t.Helper()
	provider.UsingFlags(t, map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagCloudRBACRoles: setting.NewInMemoryFlag(featuremgmt.FlagCloudRBACRoles, enabled),
	})
}

func TestGComSSOService_LogoutHook(t *testing.T) {
	// #nosec G101 -- test fixture, not a real credential
	cfg := &setting.Cfg{
		GrafanaComURL:         "http://example.com",
		GrafanaComSSOAPIToken: "sso-api-token",
	}

	s := ProvideGComSSOService(cfg)

	t.Run("Successfully logs out from grafana.com", func(t *testing.T) {
		setCloudRBACRolesFlag(t, true)

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
		setCloudRBACRolesFlag(t, true)

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

	t.Run("Skips grafana.com logout when cloudRBACRoles is disabled", func(t *testing.T) {
		setCloudRBACRolesFlag(t, false)

		called := false
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			called = true
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
		require.False(t, called, "grafana.com logout endpoint should not be called when flag is disabled")
	})
}
