package contexthandler_test

import (
	"context"
	"errors"
	"net/http"
	"sync"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/contexthandler/ctxkey"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
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

	t.Run("openfeature evaluation context defaults", func(t *testing.T) {
		handler := contexthandler.ProvideService(
			setting.NewCfg(),
			&authntest.FakeService{ExpectedErr: errors.New("some error")},
			featuremgmt.WithFeatures(),
		)

		server := webtest.NewServer(t, routing.NewRouteRegister())
		server.Mux.Use(handler.Middleware)
		server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {
			evalCtx := openfeature.TransactionContext(c.Req.Context())
			require.NotNil(t, evalCtx)
			require.Equal(t, "default", evalCtx.Attribute("namespace"))
		})

		res, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
		require.NoError(t, res.Body.Close())
	})

	t.Run("openfeature evaluation context with user namespace", func(t *testing.T) {
		handler := contexthandler.ProvideService(
			setting.NewCfg(),
			&authntest.FakeService{
				ExpectedIdentity: &authn.Identity{
					ID:        "1",
					Type:      claims.TypeUser,
					Namespace: "org-3",
				},
			},
			featuremgmt.WithFeatures(),
		)

		server := webtest.NewServer(t, routing.NewRouteRegister())
		server.Mux.Use(handler.Middleware)
		server.Mux.Get("/api/handler", func(c *contextmodel.ReqContext) {
			evalCtx := openfeature.TransactionContext(c.Req.Context())
			require.NotNil(t, evalCtx)
			require.Equal(t, "org-3", evalCtx.Attribute("namespace"))
		})

		res, err := server.Send(server.NewGetRequest("/api/handler"))
		require.NoError(t, err)
		require.NoError(t, res.Body.Close())
	})

	t.Run("concurrent header access should not panic", func(t *testing.T) {
		// Create an HTTP request with headers
		req, err := http.NewRequest("GET", "/test", nil)
		require.NoError(t, err)
		req.Header.Set("X-Test-Header", "test-value")
		req.Header.Set("X-Panel-Id", "123")
		req.Header.Set("Cookie", "session=abc123")

		// Create a context with ReqContext
		webCtx := &web.Context{
			Req: req,
		}
		reqCtx := &contextmodel.ReqContext{
			Context:      webCtx,
			SignedInUser: &user.SignedInUser{},
		}

		ctx := context.WithValue(context.Background(), ctxkey.Key{}, reqCtx)

		// Test concurrent access to headers
		const numGoroutines = 50
		const numIterations = 100

		var wg sync.WaitGroup
		panics := make(chan interface{}, numGoroutines*numIterations)

		// Launch multiple goroutines that concurrently access headers
		for i := 0; i < numGoroutines; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				defer func() {
					if r := recover(); r != nil {
						panics <- r
					}
				}()

				for j := 0; j < numIterations; j++ {
					// Get ReqContext from context (this should return a copy with cloned request)
					gotReqCtx := contexthandler.FromContext(ctx)
					// if gotReqCtx != nil && gotReqCtx.Req != nil {
					// Access headers concurrently - this used to panic
					_ = gotReqCtx.Req.Header.Get("X-Test-Header")
					_ = gotReqCtx.Req.Header.Get("X-Panel-Id")
					_ = gotReqCtx.Req.Header.Get("Cookie")
					_ = gotReqCtx.Req.Header.Get("Non-Existent-Header")
					// }
				}
			}()
		}

		// Wait for all goroutines to complete
		wg.Wait()
		close(panics)

		// Verify no panics occurred
		var panicCount int
		for panic := range panics {
			t.Errorf("Unexpected panic during concurrent header access: %v", panic)
			panicCount++
		}

		require.Equal(t, 0, panicCount, "Expected no panics during concurrent header access")
	})
}
