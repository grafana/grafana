package contexthandler_test

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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
			&authntest.FakeService{ExpectedErr: errors.New("some error")},
			featuremgmt.WithFeatures(),
		)

		server := webtest.NewServer(t, routing.NewRouteRegister())
		server.Mux.Use(handler.Middleware)
		server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {
			require.False(t, c.IsSignedIn)
			require.EqualValues(t, &user.SignedInUser{Permissions: map[int64]map[string][]string{}}, c.SignedInUser)
			require.Error(t, c.LookupTokenErr)
		})

		res, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
		require.NoError(t, res.Body.Close())
	})

	t.Run("should set identity on successful authentication", func(t *testing.T) {
		id := &authn.Identity{ID: "1", Type: claims.TypeUser, OrgID: 1}
		handler := contexthandler.ProvideService(
			setting.NewCfg(),
			&authntest.FakeService{ExpectedIdentity: id},
			featuremgmt.WithFeatures(),
		)

		server := webtest.NewServer(t, routing.NewRouteRegister())
		server.Mux.Use(handler.Middleware)
		server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {
			require.True(t, c.IsSignedIn)
			require.EqualValues(t, id.SignedInUser(), c.SignedInUser)
			require.NoError(t, c.LookupTokenErr)

			requester, err := identity.GetRequester(c.Req.Context())
			require.NoError(t, err)
			require.Equal(t, id, requester)
		})

		res, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
		require.NoError(t, res.Body.Close())
	})

	t.Run("should not set IsSignedIn on anonymous identity", func(t *testing.T) {
		identity := &authn.Identity{ID: "0", Type: claims.TypeAnonymous, OrgID: 1}
		handler := contexthandler.ProvideService(
			setting.NewCfg(),
			&authntest.FakeService{ExpectedIdentity: identity},
			featuremgmt.WithFeatures(),
		)

		server := webtest.NewServer(t, routing.NewRouteRegister())
		server.Mux.Use(handler.Middleware)
		server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {
			require.False(t, c.IsSignedIn)
			require.EqualValues(t, identity.SignedInUser(), c.SignedInUser)
			require.NoError(t, c.LookupTokenErr)
		})

		res, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
		require.NoError(t, res.Body.Close())
	})

	t.Run("should set IsRenderCall when authenticated by render client", func(t *testing.T) {
		identity := &authn.Identity{OrgID: 1, AuthenticatedBy: login.RenderModule}
		handler := contexthandler.ProvideService(
			setting.NewCfg(),
			&authntest.FakeService{ExpectedIdentity: identity},
			featuremgmt.WithFeatures(),
		)

		server := webtest.NewServer(t, routing.NewRouteRegister())
		server.Mux.Use(handler.Middleware)
		server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {
			require.True(t, c.IsSignedIn)
			require.True(t, c.IsRenderCall)
			require.EqualValues(t, identity.SignedInUser(), c.SignedInUser)
			require.NoError(t, c.LookupTokenErr)
		})

		res, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
		require.NoError(t, res.Body.Close())
	})

	t.Run("should store auth header in context", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.JWTAuth.Enabled = true
		cfg.JWTAuth.HeaderName = "jwt-header"
		cfg.AuthProxy.Enabled = true
		cfg.AuthProxy.HeaderName = "proxy-header"
		cfg.AuthProxy.Headers = map[string]string{
			"name": "proxy-header-name",
		}

		handler := contexthandler.ProvideService(
			cfg,
			&authntest.FakeService{ExpectedIdentity: &authn.Identity{}},
			featuremgmt.WithFeatures(),
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

		res, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
		require.NoError(t, res.Body.Close())
	})

	t.Run("id response headers", func(t *testing.T) {
		run := func(cfg *setting.Cfg, id string) *http.Response {
			typ, i, err := claims.ParseTypeID(id)
			require.NoError(t, err)

			handler := contexthandler.ProvideService(
				cfg,
				&authntest.FakeService{ExpectedIdentity: &authn.Identity{ID: i, Type: typ}},
				featuremgmt.WithFeatures(),
			)

			server := webtest.NewServer(t, routing.NewRouteRegister())
			server.Mux.Use(handler.Middleware)
			server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {})

			res, err := server.Send(server.NewGetRequest("/api/handler"))
			require.NoError(t, err)

			return res
		}

		t.Run("should add id header for user", func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.IDResponseHeaderEnabled = true
			cfg.IDResponseHeaderPrefix = "X-Grafana"
			cfg.IDResponseHeaderNamespaces = map[string]struct{}{"user": {}}
			res := run(cfg, "user:1")

			require.Equal(t, "user:1", res.Header.Get("X-Grafana-Identity-Id"))
			require.NoError(t, res.Body.Close())
		})

		t.Run("should not add id header for user when id is 0", func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.IDResponseHeaderEnabled = true
			cfg.IDResponseHeaderPrefix = "X-Grafana"
			cfg.IDResponseHeaderNamespaces = map[string]struct{}{"user": {}}
			res := run(cfg, "user:0")

			require.Empty(t, res.Header.Get("X-Grafana-Identity-Id"))
			require.NoError(t, res.Body.Close())
		})

		t.Run("should add id header for service account", func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.IDResponseHeaderEnabled = true
			cfg.IDResponseHeaderPrefix = "X-Grafana"
			cfg.IDResponseHeaderNamespaces = map[string]struct{}{"service-account": {}}
			res := run(cfg, "service-account:1")

			require.Equal(t, "service-account:1", res.Header.Get("X-Grafana-Identity-Id"))
			require.NoError(t, res.Body.Close())
		})

		t.Run("should not add id header for service account when not configured", func(t *testing.T) {
			cfg := setting.NewCfg()
			cfg.IDResponseHeaderEnabled = true
			cfg.IDResponseHeaderPrefix = "X-Grafana"
			cfg.IDResponseHeaderNamespaces = map[string]struct{}{"user": {}}
			res := run(cfg, "service-account:1")

			require.Empty(t, res.Header.Get("X-Grafana-Identity-Id"))
			require.NoError(t, res.Body.Close())
		})
	})
}
