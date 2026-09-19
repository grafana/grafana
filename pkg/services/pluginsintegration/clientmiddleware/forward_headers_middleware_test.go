package clientmiddleware

import (
	"encoding/json"
	"net/http"
	"sync"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/handlertest"
	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

// defaultDenyList is the deny list applied under normal Grafana configuration.
// Tests should use this so behavior stays realistic when we tune the default
// list. Individual tests can override.
var defaultDenyList = setting.DefaultDataSourceForwardHeadersDenyList

// newTestForwardHeadersMiddleware builds the middleware with JWT auth and
// auth proxy disabled, which is the default Grafana configuration. Tests that
// care about those auth headers construct the middleware directly.
func newTestForwardHeadersMiddleware(denyList []string) backend.HandlerMiddleware {
	return NewForwardHeadersMiddleware(denyList, &setting.AuthJWTSettings{}, &setting.AuthProxySettings{})
}

// openfeature.SetProviderAndWait mutates global state, so tests that touch it
// must not run in parallel with each other.
var forwardHeadersFlagMu sync.Mutex

func enableForwardHeadersFlag(t *testing.T) {
	t.Helper()
	forwardHeadersFlagMu.Lock()
	err := openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		featuremgmt.FlagGrafanaDatasourceForwardHeaders: {
			Key:            featuremgmt.FlagGrafanaDatasourceForwardHeaders,
			DefaultVariant: "enabled",
			Variants:       map[string]any{"enabled": true, "disabled": false},
		},
	}))
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
		forwardHeadersFlagMu.Unlock()
	})
}

func newForwardHeadersReq(t *testing.T) *http.Request {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, "/api/ds/query", nil)
	require.NoError(t, err)
	return req
}

func newForwardHeadersPluginCtx(t *testing.T, allowed []string) backend.PluginContext {
	t.Helper()
	jsonDataMap := map[string]any{}
	if allowed != nil {
		jsonDataMap["allowedHeaders"] = allowed
	}
	jsonDataBytes, err := json.Marshal(&jsonDataMap)
	require.NoError(t, err)
	return backend.PluginContext{
		DataSourceInstanceSettings: &backend.DataSourceInstanceSettings{
			JSONData: jsonDataBytes,
		},
	}
}

func TestForwardHeadersMiddleware_FeatureToggleOff(t *testing.T) {
	req := newForwardHeadersReq(t)
	req.Header.Set("X-Scope-OrgID", "tenant-a")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(newTestForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Scope-OrgID"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	// Feature toggle off: header must not be forwarded even though it is
	// allow-listed and present on the incoming request.
	require.Empty(t, cdt.QueryDataReq.GetHTTPHeader("X-Scope-OrgID"))
}

func TestForwardHeadersMiddleware_NoAllowList(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	req.Header.Set("X-Scope-OrgID", "tenant-a")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(newTestForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, nil)

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Empty(t, cdt.QueryDataReq.GetHTTPHeaders())
}

func TestForwardHeadersMiddleware_ExactMatch(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	req.Header.Set("X-Scope-OrgID", "tenant-a")
	req.Header.Set("X-Other", "should-be-dropped")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(newTestForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Scope-OrgID"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	// Assert via GetHTTPHeader, the same accessor the SDK's outbound HTTP
	// client middleware uses -- this is what actually reaches the plugin's
	// downstream HTTP requests, not just the raw Headers map entry.
	require.Equal(t, "tenant-a", cdt.QueryDataReq.GetHTTPHeader("X-Scope-OrgID"))
	require.Empty(t, cdt.QueryDataReq.GetHTTPHeader("X-Other"))
}

func TestForwardHeadersMiddleware_CaseInsensitiveAllowMatch(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	// Header set with unusual casing on the incoming request.
	req.Header.Set("x-scope-orgid", "tenant-a")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(newTestForwardHeadersMiddleware(defaultDenyList)),
	)
	// Allow-list entry in a totally different case.
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-SCOPE-ORGID"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Equal(t, "tenant-a", cdt.QueryDataReq.GetHTTPHeader("X-Scope-OrgID"))
}

func TestForwardHeadersMiddleware_PrefixMatch(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	req.Header.Set("X-Tenant-Id", "t1")
	req.Header.Set("X-Tenant-Cluster", "c1")
	req.Header.Set("X-Unrelated", "nope")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(newTestForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Tenant-[]"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Equal(t, "t1", cdt.QueryDataReq.GetHTTPHeader("X-Tenant-Id"))
	require.Equal(t, "c1", cdt.QueryDataReq.GetHTTPHeader("X-Tenant-Cluster"))
	require.Empty(t, cdt.QueryDataReq.GetHTTPHeader("X-Unrelated"))
}

func TestForwardHeadersMiddleware_DenyListWins(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	// Try to smuggle Authorization through even though it matches the
	// admin's overly-broad allow-list.
	req.Header.Set("Authorization", "Bearer sneaky")
	req.Header.Set("X-Scope-OrgID", "tenant-a")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(newTestForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"[]"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	// Authorization is on the default deny list and must be stripped even
	// though the datasource allow-lists everything.
	require.Empty(t, cdt.QueryDataReq.GetHTTPHeader("Authorization"))
	require.Equal(t, "tenant-a", cdt.QueryDataReq.GetHTTPHeader("X-Scope-OrgID"))
}

func TestForwardHeadersMiddleware_KillSwitch(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	req.Header.Set("X-Scope-OrgID", "tenant-a")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(newTestForwardHeadersMiddleware([]string{"[]"})),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Scope-OrgID"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Empty(t, cdt.QueryDataReq.GetHTTPHeaders())
}

func TestForwardHeadersMiddleware_DoesNotClobberExisting(t *testing.T) {
	enableForwardHeadersFlag(t)

	// An earlier middleware (OAuth, tracing, cookies) may have already set a
	// header via SetHTTPHeader. ForwardHeadersMiddleware must not overwrite it.
	req := newForwardHeadersReq(t)
	req.Header.Set("X-Scope-OrgID", "from-incoming")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(newTestForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Scope-OrgID"})

	priorReq := &backend.QueryDataRequest{PluginContext: pluginCtx}
	priorReq.SetHTTPHeader("X-Scope-OrgID", "prior-value")

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), priorReq)
	require.NoError(t, err)
	require.Equal(t, "prior-value", cdt.QueryDataReq.GetHTTPHeader("X-Scope-OrgID"))
}

func TestForwardHeadersMiddleware_CallResourceMultiValue(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	req.Header.Add("X-Multi", "a")
	req.Header.Add("X-Multi", "b")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(newTestForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Multi"})

	err := cdt.MiddlewareHandler.CallResource(req.Context(), &backend.CallResourceRequest{
		PluginContext: pluginCtx,
		Headers:       map[string][]string{},
	}, nopCallResourceSender)
	require.NoError(t, err)
	// CallResource preserves each value separately.
	require.Equal(t, []string{"a", "b"}, cdt.CallResourceReq.Headers["X-Multi"])
}

func TestForwardHeadersMiddleware_QueryDataMultiValueJoins(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	req.Header.Add("X-Multi", "a")
	req.Header.Add("X-Multi", "b")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(newTestForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Multi"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	// QueryData carries a string-valued map, so RFC 9110 5.3 field-line
	// combining applies: repeated values are joined with ", ".
	require.Equal(t, "a, b", cdt.QueryDataReq.GetHTTPHeader("X-Multi"))
}

func TestForwardHeadersMiddleware_AllRequestTypes(t *testing.T) {
	enableForwardHeadersFlag(t)

	build := func(t *testing.T) (*handlertest.HandlerMiddlewareTest, backend.PluginContext, *http.Request) {
		t.Helper()
		req := newForwardHeadersReq(t)
		req.Header.Set("X-Scope-OrgID", "tenant-a")
		cdt := handlertest.NewHandlerMiddlewareTest(t,
			WithReqContext(req, &user.SignedInUser{}),
			handlertest.WithMiddlewares(newTestForwardHeadersMiddleware(defaultDenyList)),
		)
		return cdt, newForwardHeadersPluginCtx(t, []string{"X-Scope-OrgID"}), req
	}

	t.Run("QueryChunkedData", func(t *testing.T) {
		cdt, pluginCtx, req := build(t)
		err := cdt.MiddlewareHandler.QueryChunkedData(req.Context(), &backend.QueryChunkedDataRequest{
			PluginContext: pluginCtx,
			Headers:       map[string]string{},
		}, nopChunkedWriter{})
		require.NoError(t, err)
		require.Equal(t, "tenant-a", cdt.QueryChunkedDataReq.GetHTTPHeader("X-Scope-OrgID"))
	})

	t.Run("CheckHealth", func(t *testing.T) {
		cdt, pluginCtx, req := build(t)
		_, err := cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
			PluginContext: pluginCtx,
			Headers:       map[string]string{},
		})
		require.NoError(t, err)
		require.Equal(t, "tenant-a", cdt.CheckHealthReq.GetHTTPHeader("X-Scope-OrgID"))
	})

	t.Run("CallResource", func(t *testing.T) {
		cdt, pluginCtx, req := build(t)
		err := cdt.MiddlewareHandler.CallResource(req.Context(), &backend.CallResourceRequest{
			PluginContext: pluginCtx,
			Headers:       map[string][]string{},
		}, nopCallResourceSender)
		require.NoError(t, err)
		require.Equal(t, []string{"tenant-a"}, cdt.CallResourceReq.Headers["X-Scope-Orgid"])
	})
}

func TestForwardHeadersMiddleware_NoReqContext(t *testing.T) {
	enableForwardHeadersFlag(t)

	// No WithReqContext, so contexthandler.FromContext returns nil -> no-op.
	req := newForwardHeadersReq(t)
	cdt := handlertest.NewHandlerMiddlewareTest(t,
		handlertest.WithMiddlewares(newTestForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Scope-OrgID"})
	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Empty(t, cdt.QueryDataReq.Headers)
}

func TestForwardHeadersMiddleware_AppInstance_NoOp(t *testing.T) {
	enableForwardHeadersFlag(t)

	// App plugins do not have DataSourceInstanceSettings, so the allow-list
	// cannot be read and the middleware is a no-op.
	req := newForwardHeadersReq(t)
	req.Header.Set("X-Scope-OrgID", "tenant-a")
	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(newTestForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := backend.PluginContext{AppInstanceSettings: &backend.AppInstanceSettings{}}
	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Empty(t, cdt.QueryDataReq.Headers)
}

// ClearAuthHeadersMiddleware strips the headers Grafana authenticated the
// incoming request with. Those names are configurable, so they cannot be in
// the static default deny-list — the middleware must derive them from config
// and never re-forward them, even for an allow-list of "[]".
func TestForwardHeadersMiddleware_ConfiguredAuthHeadersNeverForwarded(t *testing.T) {
	enableForwardHeadersFlag(t)

	jwtAuth := &setting.AuthJWTSettings{Enabled: true, HeaderName: "X-JWT-Assertion"}
	authProxy := &setting.AuthProxySettings{
		Enabled:    true,
		HeaderName: "X-WEBAUTH-USER",
		Headers:    map[string]string{"Groups": "X-WEBAUTH-GROUPS", "Email": "X-WEBAUTH-EMAIL"},
	}

	req := newForwardHeadersReq(t)
	req.Header.Set("X-JWT-Assertion", "jwt-token")
	req.Header.Set("X-WEBAUTH-USER", "admin")
	req.Header.Set("X-WEBAUTH-GROUPS", "admins")
	req.Header.Set("X-WEBAUTH-EMAIL", "admin@example.com")
	req.Header.Set("X-Grafana-Device-Id", "device-1")
	req.Header.Set("X-Scope-OrgID", "tenant-a")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList, jwtAuth, authProxy)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"[]"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	for _, name := range []string{"X-Jwt-Assertion", "X-Webauth-User", "X-Webauth-Groups", "X-Webauth-Email", "X-Grafana-Device-Id"} {
		require.Empty(t, cdt.QueryDataReq.GetHTTPHeader(name))
	}
	require.Equal(t, "tenant-a", cdt.QueryDataReq.GetHTTPHeader("X-Scope-OrgID"))
}

// An explicit allow-list entry for a configured auth header must not beat the
// deny-list either.
func TestForwardHeadersMiddleware_ExplicitlyAllowedAuthProxyHeaderDenied(t *testing.T) {
	enableForwardHeadersFlag(t)

	authProxy := &setting.AuthProxySettings{Enabled: true, HeaderName: "X-WEBAUTH-USER"}

	req := newForwardHeadersReq(t)
	req.Header.Set("X-WEBAUTH-USER", "admin")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList, &setting.AuthJWTSettings{}, authProxy)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-WEBAUTH-USER"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Empty(t, cdt.QueryDataReq.GetHTTPHeaders())
}

// With auth proxy disabled its header name carries no Grafana credential, so
// it is forwardable like any other header.
func TestForwardHeadersMiddleware_AuthProxyDisabledHeaderForwardable(t *testing.T) {
	enableForwardHeadersFlag(t)

	authProxy := &setting.AuthProxySettings{Enabled: false, HeaderName: "X-WEBAUTH-USER"}

	req := newForwardHeadersReq(t)
	req.Header.Set("X-WEBAUTH-USER", "admin")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList, &setting.AuthJWTSettings{}, authProxy)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-WEBAUTH-USER"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Equal(t, "admin", cdt.QueryDataReq.GetHTTPHeader("X-WEBAUTH-USER"))
}
