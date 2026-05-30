package datasource

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

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
		datasourceResourceInfo: datasourceV0.DataSourceResourceInfo.WithGroupAndShortName("test.datasource.grafana.app", "test"),
		pluginJSON:             plugins.JSONData{ID: "test"},
		datasources:            provider,
		proxyDeps: &ProxyDependencies{
			ProxyCfg:                   pluginproxy.NewDataSourceProxySettings(setting.NewCfg()),
			DataSourceRequestValidator: allowAllValidator{},
			HTTPClientProvider:         httpclient.NewProvider(),
			OAuthTokenService:          &oauthtoken.Service{},
			Tracer:                     tracing.InitializeTracerForTest(),
			Features:                   featuremgmt.WithFeatures(),
		},
	}
}

func proxyTestContext() context.Context {
	return identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1, Login: "admin"})
}

func TestSubProxyREST_Connect(t *testing.T) {
	t.Run("responds NotFound when the datasource does not exist", func(t *testing.T) {
		provider := &proxyMockDatasourceProvider{dsErr: datasources.ErrDataSourceNotFound}
		r := &subProxyREST{builder: newProxyTestBuilder(provider)}

		responder := &resourceMockResponder{}
		handler, err := r.Connect(proxyTestContext(), "missing", nil, responder)
		require.NoError(t, err)
		require.NotNil(t, handler)

		req := httptest.NewRequest(http.MethodGet, "/namespaces/default/datasources/missing/proxy/x", nil)
		handler.ServeHTTP(httptest.NewRecorder(), req)
		require.True(t, apierrors.IsNotFound(responder.lastErr))
	})

	t.Run("returns an error when proxy dependencies are not configured", func(t *testing.T) {
		builder := newProxyTestBuilder(&proxyMockDatasourceProvider{})
		builder.proxyDeps = nil
		r := &subProxyREST{builder: builder}

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
		r := &subProxyREST{builder: newProxyTestBuilder(provider)}

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
	tests := map[string]string{
		"/namespaces/default/datasources/x/proxy/api/v1/query": "api/v1/query",
		"/namespaces/default/datasources/x/proxy":              "",
		"/namespaces/default/datasources/x/proxy/":             "",
		"/no/proxy/segment/here":                               "segment/here",
	}
	for path, want := range tests {
		req := httptest.NewRequest(http.MethodGet, path, nil)
		require.Equal(t, want, proxyPathFromRequest(req), "path %q", path)
	}
}
