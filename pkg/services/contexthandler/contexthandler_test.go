package contexthandler_test

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web/webtest"
)

func TestContextHandler(t *testing.T) {
	t.Run("should set auth error if authentication was unsuccessful", func(t *testing.T) {
		handler := contexthandler.ProvideService(
			setting.NewCfg(),
			tracing.InitializeTracerForTest(),
			featuremgmt.WithFeatures(),
			&authntest.FakeService{ExpectedErr: errors.New("some error")},
		)

		server := webtest.NewServer(t, routing.NewRouteRegister())
		server.Mux.Use(handler.Middleware)
		server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {
			require.False(t, c.IsSignedIn)
			require.EqualValues(t, &user.SignedInUser{Permissions: map[int64]map[string][]string{}}, c.SignedInUser)
			require.Error(t, c.LookupTokenErr)
		})

		_, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
	})

	t.Run("should set identity on successful authentication", func(t *testing.T) {
		identity := &authn.Identity{ID: authn.NamespacedID(authn.NamespaceUser, 1), OrgID: 1}
		handler := contexthandler.ProvideService(
			setting.NewCfg(),
			tracing.InitializeTracerForTest(),
			featuremgmt.WithFeatures(),
			&authntest.FakeService{ExpectedIdentity: identity},
		)

		server := webtest.NewServer(t, routing.NewRouteRegister())
		server.Mux.Use(handler.Middleware)
		server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {
			require.True(t, c.IsSignedIn)
			require.EqualValues(t, identity.SignedInUser(), c.SignedInUser)
			require.NoError(t, c.LookupTokenErr)
		})

		_, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
	})

	t.Run("should not set IsSignedIn on anonymous identity", func(t *testing.T) {
		identity := &authn.Identity{ID: authn.AnonymousNamespaceID, OrgID: 1}
		handler := contexthandler.ProvideService(
			setting.NewCfg(),
			tracing.InitializeTracerForTest(),
			featuremgmt.WithFeatures(),
			&authntest.FakeService{ExpectedIdentity: identity},
		)

		server := webtest.NewServer(t, routing.NewRouteRegister())
		server.Mux.Use(handler.Middleware)
		server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {
			require.False(t, c.IsSignedIn)
			require.EqualValues(t, identity.SignedInUser(), c.SignedInUser)
			require.NoError(t, c.LookupTokenErr)
		})

		_, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
	})

	t.Run("should set IsRenderCall when authenticated by render client", func(t *testing.T) {
		identity := &authn.Identity{OrgID: 1, AuthenticatedBy: login.RenderModule}
		handler := contexthandler.ProvideService(
			setting.NewCfg(),
			tracing.InitializeTracerForTest(),
			featuremgmt.WithFeatures(),
			&authntest.FakeService{ExpectedIdentity: identity},
		)

		server := webtest.NewServer(t, routing.NewRouteRegister())
		server.Mux.Use(handler.Middleware)
		server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {
			require.True(t, c.IsSignedIn)
			require.True(t, c.IsRenderCall)
			require.EqualValues(t, identity.SignedInUser(), c.SignedInUser)
			require.NoError(t, c.LookupTokenErr)
		})

		_, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
	})

	t.Run("should delete session cookie on invalid session", func(t *testing.T) {
		handler := contexthandler.ProvideService(
			setting.NewCfg(),
			tracing.InitializeTracerForTest(),
			featuremgmt.WithFeatures(),
			&authntest.FakeService{ExpectedErr: auth.ErrInvalidSessionToken},
		)

		server := webtest.NewServer(t, routing.NewRouteRegister())
		server.Mux.Use(handler.Middleware)
		server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {})

		res, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
		cookies := res.Cookies()
		require.Len(t, cookies, 1)
		require.Equal(t, cookies[0].String(), "grafana_session_expiry=; Path=/; Max-Age=0")
		require.NoError(t, res.Body.Close())
	})

	t.Run("should delete session cookie when oauth token refresh failed", func(t *testing.T) {
		handler := contexthandler.ProvideService(
			setting.NewCfg(),
			tracing.InitializeTracerForTest(),
			featuremgmt.WithFeatures(),
			&authntest.FakeService{ExpectedErr: authn.ErrExpiredAccessToken.Errorf("")},
		)

		server := webtest.NewServer(t, routing.NewRouteRegister())
		server.Mux.Use(handler.Middleware)
		server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {})

		res, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
		cookies := res.Cookies()
		require.Len(t, cookies, 1)
		require.Equal(t, cookies[0].String(), "grafana_session_expiry=; Path=/; Max-Age=0")
		require.NoError(t, res.Body.Close())
	})

	t.Run("should store auth header in context", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.JWTAuthEnabled = true
		cfg.JWTAuthHeaderName = "jwt-header"
		cfg.AuthProxyEnabled = true
		cfg.AuthProxyHeaderName = "proxy-header"
		cfg.AuthProxyHeaders = map[string]string{
			"name": "proxy-header-name",
		}

		handler := contexthandler.ProvideService(
			cfg,
			tracing.InitializeTracerForTest(),
			featuremgmt.WithFeatures(),
			&authntest.FakeService{ExpectedIdentity: &authn.Identity{}},
		)

		server := webtest.NewServer(t, routing.NewRouteRegister())
		server.Mux.Use(handler.Middleware)
		server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {
			list := contexthandler.AuthHTTPHeaderListFromContext(c.Req.Context())
			require.NotNil(t, list)

			assert.Contains(t, list.Items, "jwt-header")
			assert.Contains(t, list.Items, "proxy-header")
			assert.Contains(t, list.Items, "proxy-header-name")
			assert.Contains(t, list.Items, "Authorization")
		})

		_, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
	})
}
