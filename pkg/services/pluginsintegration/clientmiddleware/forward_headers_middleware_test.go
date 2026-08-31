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
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Scope-OrgID"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	// Feature toggle off: header must not be forwarded even though it is
	// allow-listed and present on the incoming request.
	require.NotContains(t, cdt.QueryDataReq.Headers, "X-Scope-Orgid")
	require.NotContains(t, cdt.QueryDataReq.Headers, "X-Scope-OrgID")
}

func TestForwardHeadersMiddleware_NoAllowList(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	req.Header.Set("X-Scope-OrgID", "tenant-a")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, nil)

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Empty(t, cdt.QueryDataReq.Headers)
}

func TestForwardHeadersMiddleware_ExactMatch(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	req.Header.Set("X-Scope-OrgID", "tenant-a")
	req.Header.Set("X-Other", "should-be-dropped")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Scope-OrgID"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Equal(t, "tenant-a", cdt.QueryDataReq.Headers["X-Scope-Orgid"])
	require.NotContains(t, cdt.QueryDataReq.Headers, "X-Other")
}

func TestForwardHeadersMiddleware_CaseInsensitiveAllowMatch(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	// Header set with unusual casing on the incoming request.
	req.Header.Set("x-scope-orgid", "tenant-a")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList)),
	)
	// Allow-list entry in a totally different case.
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-SCOPE-ORGID"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Equal(t, "tenant-a", cdt.QueryDataReq.Headers["X-Scope-Orgid"])
}

func TestForwardHeadersMiddleware_PrefixMatch(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	req.Header.Set("X-Tenant-Id", "t1")
	req.Header.Set("X-Tenant-Cluster", "c1")
	req.Header.Set("X-Unrelated", "nope")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Tenant-[]"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Equal(t, "t1", cdt.QueryDataReq.Headers["X-Tenant-Id"])
	require.Equal(t, "c1", cdt.QueryDataReq.Headers["X-Tenant-Cluster"])
	require.NotContains(t, cdt.QueryDataReq.Headers, "X-Unrelated")
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
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"[]"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	// Authorization is on the default deny list and must be stripped even
	// though the datasource allow-lists everything.
	require.NotContains(t, cdt.QueryDataReq.Headers, "Authorization")
	require.Equal(t, "tenant-a", cdt.QueryDataReq.Headers["X-Scope-Orgid"])
}

func TestForwardHeadersMiddleware_KillSwitch(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	req.Header.Set("X-Scope-OrgID", "tenant-a")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware([]string{"[]"})),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Scope-OrgID"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Empty(t, cdt.QueryDataReq.Headers)
}

func TestForwardHeadersMiddleware_DoesNotClobberExisting(t *testing.T) {
	enableForwardHeadersFlag(t)

	// An earlier middleware (OAuth, tracing, cookies) may have already set a
	// header on req.Headers. ForwardHeadersMiddleware must not overwrite it.
	req := newForwardHeadersReq(t)
	req.Header.Set("X-Scope-OrgID", "from-incoming")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Scope-OrgID"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{"X-Scope-Orgid": "prior-value"},
	})
	require.NoError(t, err)
	require.Equal(t, "prior-value", cdt.QueryDataReq.Headers["X-Scope-Orgid"])
}

func TestForwardHeadersMiddleware_CallResourceMultiValue(t *testing.T) {
	enableForwardHeadersFlag(t)

	req := newForwardHeadersReq(t)
	req.Header.Add("X-Multi", "a")
	req.Header.Add("X-Multi", "b")

	cdt := handlertest.NewHandlerMiddlewareTest(t,
		WithReqContext(req, &user.SignedInUser{}),
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList)),
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
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := newForwardHeadersPluginCtx(t, []string{"X-Multi"})

	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	// QueryData carries a string-valued map, so RFC 9110 5.3 field-line
	// combining applies: repeated values are joined with ", ".
	require.Equal(t, "a, b", cdt.QueryDataReq.Headers["X-Multi"])
}

func TestForwardHeadersMiddleware_AllRequestTypes(t *testing.T) {
	enableForwardHeadersFlag(t)

	build := func(t *testing.T) (*handlertest.HandlerMiddlewareTest, backend.PluginContext, *http.Request) {
		t.Helper()
		req := newForwardHeadersReq(t)
		req.Header.Set("X-Scope-OrgID", "tenant-a")
		cdt := handlertest.NewHandlerMiddlewareTest(t,
			WithReqContext(req, &user.SignedInUser{}),
			handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList)),
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
		require.Equal(t, "tenant-a", cdt.QueryChunkedDataReq.Headers["X-Scope-Orgid"])
	})

	t.Run("CheckHealth", func(t *testing.T) {
		cdt, pluginCtx, req := build(t)
		_, err := cdt.MiddlewareHandler.CheckHealth(req.Context(), &backend.CheckHealthRequest{
			PluginContext: pluginCtx,
			Headers:       map[string]string{},
		})
		require.NoError(t, err)
		require.Equal(t, "tenant-a", cdt.CheckHealthReq.Headers["X-Scope-Orgid"])
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
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList)),
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
		handlertest.WithMiddlewares(NewForwardHeadersMiddleware(defaultDenyList)),
	)
	pluginCtx := backend.PluginContext{AppInstanceSettings: &backend.AppInstanceSettings{}}
	_, err := cdt.MiddlewareHandler.QueryData(req.Context(), &backend.QueryDataRequest{
		PluginContext: pluginCtx,
		Headers:       map[string]string{},
	})
	require.NoError(t, err)
	require.Empty(t, cdt.QueryDataReq.Headers)
}
