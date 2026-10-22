package datasource

import (
	"context"
	"errors"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	sdkproxy "github.com/grafana/grafana-plugin-sdk-go/backend/proxy"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	krequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestSubProxyPDCRouting(t *testing.T) {
	var directRequests atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { directRequests.Add(1) }))
	t.Cleanup(upstream.Close)
	pdc, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = pdc.Close() })
	greeting := make(chan byte, 1)
	go func() {
		conn, err := pdc.Accept()
		if err != nil {
			return
		}
		defer func() { _ = conn.Close() }()
		_ = conn.SetDeadline(time.Now().Add(5 * time.Second))
		var header [2]byte
		if _, err := io.ReadFull(conn, header[:]); err != nil {
			return
		}
		if _, err := io.CopyN(io.Discard, conn, int64(header[1])); err != nil {
			return
		}
		greeting <- header[0]
		// Refuse SOCKS authentication: the request must fail, never fall back to direct access.
		_, _ = conn.Write([]byte{5, 255})
	}()
	ds := &datasourceV0.DataSource{}
	ds.Name = "ds-1"
	ds.Spec.SetURL(upstream.URL)
	ds.Spec.SetJSONData(map[string]any{"enableSecureSocksProxy": true})
	provider := &proxyMockDatasourceProvider{ds: ds}
	provider.instanceSettings = &backend.DataSourceInstanceSettings{UID: ds.Name, Type: "test", URL: upstream.URL, JSONData: []byte(`{"enableSecureSocksProxy":true}`)}
	builder := newProxyTestBuilder(provider)
	deps, err := builder.proxyDependencies(t.Context(), nil)
	require.NoError(t, err)
	deps.GrafanaConfig = config.NewGrafanaCfg(map[string]string{
		sdkproxy.PluginSecureSocksProxyEnabled:       "true",
		sdkproxy.PluginSecureSocksProxyAllowInsecure: "true",
		sdkproxy.PluginSecureSocksProxyProxyAddress:  pdc.Addr().String(),
	})
	storage := &subProxyREST{builder: builder, transports: newProxyTransportCache()}
	t.Cleanup(storage.Destroy)
	responder := &resourceMockResponder{}
	handler, err := storage.Connect(proxyTestContext(), ds.Name, nil, responder)
	require.NoError(t, err)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/datasources/ds-1/proxy/query", nil))
	require.NoError(t, responder.lastErr)
	require.Equal(t, http.StatusBadGateway, rec.Code)
	select {
	case version := <-greeting:
		require.Equal(t, byte(5), version)
	case <-time.After(time.Second):
		t.Fatal("request did not reach the configured PDC proxy")
	}
	require.Zero(t, directRequests.Load())

	// A datasource requesting PDC must also fail closed when the tenant has no PDC config.
	deps.GrafanaConfig = config.NewGrafanaCfg(nil)
	handler, err = storage.Connect(proxyTestContext(), ds.Name, nil, responder)
	require.NoError(t, err)
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/datasources/ds-1/proxy/query", nil))
	require.True(t, apierrors.IsBadRequest(responder.lastErr))
	require.Zero(t, directRequests.Load())
}

type proxyMockDatasourceProvider struct {
	resourceMockDatasourceProvider
	ds    *datasourceV0.DataSource
	dsErr error
}

func (m *proxyMockDatasourceProvider) GetDataSource(ctx context.Context, uid string) (*datasourceV0.DataSource, error) {
	return m.ds, m.dsErr
}

type allowAllValidator struct{}

func (allowAllValidator) Validate(_ string, _ map[string]any, _ *http.Request) error { return nil }

func newProxyTestBuilder(provider PluginDatasourceProvider) *DataSourceAPIBuilder {
	return &DataSourceAPIBuilder{
		datasourceResourceInfo:     datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("test.datasource.grafana.app", "test"),
		pluginJSON:                 plugins.JSONData{ID: "test"},
		datasources:                provider,
		dataSourceRequestValidator: allowAllValidator{},
		proxyDependencies: ProvideProxyDependencies(setting.NewCfg(), httpclient.NewProvider(),
			&oauthtoken.Service{}, tracing.InitializeTracerForTest(), featuremgmt.WithFeatures()),
	}
}

func proxyTestContext() context.Context {
	return identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1, Login: "admin"})
}

func TestSubProxyREST_Connect(t *testing.T) {
	t.Run("rejects OAuth passthrough without a token service", func(t *testing.T) {
		forwarded := false
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			forwarded = true
		}))
		defer target.Close()
		ds := &datasourceV0.DataSource{}
		ds.Spec.SetURL(target.URL)
		ds.Spec.SetJSONData(map[string]any{"oauthPassThru": true})
		builder := newProxyTestBuilder(&proxyMockDatasourceProvider{ds: ds})
		deps, err := builder.proxyDependencies(t.Context(), nil)
		require.NoError(t, err)
		deps.OAuthTokenService = nil
		storage := &subProxyREST{builder: builder, transports: newProxyTransportCache()}
		t.Cleanup(storage.Destroy)
		responder := &resourceMockResponder{}
		handler, err := storage.Connect(proxyTestContext(), "test-ds", nil, responder)
		require.NoError(t, err)
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/namespaces/default/datasources/test-ds/proxy/query", nil))
		require.True(t, apierrors.IsBadRequest(responder.lastErr))
		require.ErrorContains(t, responder.lastErr, "OAuth passthrough is not supported")
		require.False(t, forwarded)
	})

	t.Run("responds NotFound when the datasource does not exist", func(t *testing.T) {
		provider := &proxyMockDatasourceProvider{dsErr: datasources.ErrDataSourceNotFound}
		r := &subProxyREST{builder: newProxyTestBuilder(provider), transports: newProxyTransportCache()}
		t.Cleanup(r.Destroy)

		responder := &resourceMockResponder{}
		handler, err := r.Connect(proxyTestContext(), "missing", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, handler)

		req := httptest.NewRequest(http.MethodGet, "/namespaces/default/datasources/missing/proxy/x", nil)
		handler.ServeHTTP(httptest.NewRecorder(), req)
		require.True(t, apierrors.IsNotFound(responder.lastErr))
	})

	t.Run("dependency resolution failure stops the request", func(t *testing.T) {
		builder := newProxyTestBuilder(&proxyMockDatasourceProvider{dsErr: errors.New("unexpected datasource read")})
		ctx := proxyTestContext()
		unavailable := errors.New("tenant settings unavailable")
		builder.proxyDependencies = func(gotCtx context.Context, req *http.Request) (*ProxyDependencies, error) {
			require.Equal(t, ctx, gotCtx)
			require.Equal(t, ctx, req.Context())
			return nil, unavailable
		}
		storage := &subProxyREST{builder: builder, transports: newProxyTransportCache()}
		t.Cleanup(storage.Destroy)
		responder := &resourceMockResponder{}
		handler, err := storage.Connect(ctx, "test-ds", nil, responder)
		require.NoError(t, err)
		handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/datasources/test-ds/proxy/query", nil))
		require.ErrorIs(t, responder.lastErr, unavailable)
	})

	t.Run("returns an error when proxy dependencies are not configured", func(t *testing.T) {
		builder := newProxyTestBuilder(&proxyMockDatasourceProvider{})
		builder.proxyDependencies = nil
		r := &subProxyREST{builder: builder, transports: newProxyTransportCache()}
		t.Cleanup(r.Destroy)

		handler, err := r.Connect(proxyTestContext(), "test-ds", nil, &resourceMockResponder{})
		require.Nil(t, handler)
		require.Error(t, err)
	})

	t.Run("proxies the request to the datasource backend", func(t *testing.T) {
		var gotPath string
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			gotPath = req.URL.Path
			w.WriteHeader(http.StatusOK)
			_, _ = io.WriteString(w, "pong")
		}))
		defer target.Close()

		ds := &datasourceV0.DataSource{}
		ds.Spec.SetURL(target.URL)

		provider := &proxyMockDatasourceProvider{ds: ds}
		provider.instanceSettings = &backend.DataSourceInstanceSettings{
			UID:      "test-ds",
			Type:     "test",
			URL:      target.URL,
			JSONData: []byte("{}"),
		}
		r := &subProxyREST{builder: newProxyTestBuilder(provider), transports: newProxyTransportCache()}
		t.Cleanup(r.Destroy)

		ctx := proxyTestContext()
		handler, err := r.Connect(ctx, "test-ds", nil, &resourceMockResponder{})
		require.NoError(t, err)
		require.NotNil(t, handler)

		req := httptest.NewRequest(http.MethodGet,
			"/apis/test.datasource.grafana.app/v0alpha1/namespaces/default/datasources/test-ds/proxy/api/v1/query", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, "pong", rec.Body.String())
		require.Equal(t, "/api/v1/query", gotPath)
	})
}

func TestProxyPathFromRequest(t *testing.T) {
	tests := []struct {
		path string
		name string
		want string
	}{
		{"/namespaces/default/datasources/x/proxy/api/v1/query", "x", "api/v1/query"},
		{"/namespaces/default/datasources/x/proxy", "x", ""},
		{"/namespaces/default/datasources/x/proxy/", "x", ""},
		// the forwarded path itself contains "/proxy": must keep it intact.
		{"/namespaces/default/datasources/x/proxy/admin/proxy/settings", "x", "admin/proxy/settings"},
		// the namespace happens to match the datasource name.
		{"/namespaces/proxy/datasources/proxy/proxy/api", "proxy", "api"},
		{"/no/match/here", "x", ""},
	}
	for _, tc := range tests {
		req := httptest.NewRequest(http.MethodGet, tc.path, nil)
		require.Equal(t, tc.want, proxyPathFromRequest(req, tc.name), "path %q", tc.path)
	}
}

func TestSubProxyREST_RouteAuthorization(t *testing.T) {
	for _, tc := range []struct {
		name    string
		allowed bool
		err     error
		status  int
	}{
		{"allowed with no legacy permissions", true, nil, 200},
		{"denied despite legacy admin permissions", false, nil, 403},
		{"authz error fails closed", false, errors.New("unavailable"), 403},
		{"authz error overrides allowance", true, errors.New("unavailable"), 403},
	} {
		t.Run(tc.name, func(t *testing.T) {
			forwarded := 0
			backendServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				forwarded++
				require.Equal(t, "/api/v1/query", req.URL.Path)
				w.WriteHeader(200)
			}))
			defer backendServer.Close()
			ds := &datasourceV0.DataSource{}
			ds.Name = "ds-1"
			ds.Spec.SetURL(backendServer.URL)
			provider := &proxyMockDatasourceProvider{ds: ds}
			provider.instanceSettings = &backend.DataSourceInstanceSettings{UID: "ds-1", Type: "prometheus", URL: backendServer.URL, JSONData: []byte("{}")}
			b := newProxyTestBuilder(provider)
			b.pluginJSON = plugins.JSONData{ID: "prometheus", Routes: []*plugins.Route{{Method: "POST", Path: "api/v1/query", ReqAction: "datasources:query", ReqRole: org.RoleAdmin}}}
			checks := 0
			b.accessClient = proxyAccessClient{check: func(ctx context.Context, who authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
				checks++
				require.Equal(t, authlib.CheckRequest{Namespace: "stacks-11", Group: "test.datasource.grafana.app", Resource: "datasources", Name: "ds-1", Subresource: "query", Verb: "create"}, req)
				return authlib.CheckResponse{Allowed: tc.allowed}, tc.err
			}}
			resolved := 0
			dependencies := b.proxyDependencies
			b.proxyDependencies = func(ctx context.Context, req *http.Request) (*ProxyDependencies, error) {
				resolved++
				return dependencies(ctx, req)
			}
			who := &user.SignedInUser{OrgID: 1, OrgRole: org.RoleViewer}
			if !tc.allowed {
				who.OrgRole = org.RoleAdmin
				who.Permissions = map[int64]map[string][]string{1: {"datasources:query": {"datasources:*"}}}
			}
			ctx := identity.WithRequester(krequest.WithNamespace(t.Context(), "stacks-11"), who)
			storage := &subProxyREST{builder: b, transports: newProxyTransportCache()}
			t.Cleanup(storage.Destroy)
			handler, err := storage.Connect(ctx, "ds-1", nil, &resourceMockResponder{})
			require.NoError(t, err)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), "POST", "/namespaces/stacks-11/datasources/ds-1/proxy/api/v1/query", nil))
			require.Equal(t, tc.status, rec.Code)
			require.Equal(t, 1, checks)
			require.Equal(t, 1, resolved)
			if tc.status == http.StatusOK {
				require.Equal(t, 1, forwarded)
			} else {
				require.Zero(t, forwarded)
			}
		})
	}
}
