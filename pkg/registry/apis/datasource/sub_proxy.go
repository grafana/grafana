package datasource

import (
	"context"
	"errors"
	"net/http"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/infra/httpclient"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/oauthtoken"
	"github.com/grafana/grafana/pkg/setting"
)

// ProxyDependencies bundles the proxy-only services the datasource frontend
// proxy needs. It is wired as a single dependency so RegisterAPIService doesn't
// have to thread each one through its signature. The request validator is not
// here because it is shared with the health endpoint (see DataSourceAPIBuilder).
type ProxyDependencies struct {
	ProxyCfg           *pluginproxy.DataSourceProxySettings
	HTTPClientProvider httpclient.Provider
	OAuthTokenService  *oauthtoken.Service
	Tracer             tracing.Tracer
	Features           featuremgmt.FeatureToggles
}

// ProvideProxyDependencies is the wire provider for ProxyDependencies.
func ProvideProxyDependencies(
	cfg *setting.Cfg,
	httpClientProvider httpclient.Provider,
	oAuthTokenService *oauthtoken.Service,
	tracer tracing.Tracer,
	features featuremgmt.FeatureToggles,
) *ProxyDependencies {
	return &ProxyDependencies{
		ProxyCfg:           pluginproxy.NewDataSourceProxySettings(cfg),
		HTTPClientProvider: httpClientProvider,
		OAuthTokenService:  oAuthTokenService,
		Tracer:             tracer,
		Features:           features,
	}
}

type subProxyREST struct {
	builder *DataSourceAPIBuilder
}

var _ = rest.Connecter(&subProxyREST{})

func (r *subProxyREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *subProxyREST) Destroy() {}

func (r *subProxyREST) ConnectMethods() []string {
	unique := map[string]bool{}
	methods := []string{}
	for _, route := range r.builder.pluginJSON.Routes {
		if unique[route.Method] {
			continue
		}
		unique[route.Method] = true
		methods = append(methods, route.Method)
	}
	return methods
}

func (r *subProxyREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
}

func (r *subProxyREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	m := newConnectMetric("proxy", r.builder.pluginJSON.ID)

	deps := r.builder.proxyDeps
	if deps == nil {
		m.SetError()
		m.Record()
		return nil, errors.New("datasource proxy is not configured")
	}

	loader := newDatasourceLoader(r.builder.datasources, name, r.builder.pluginJSON.ID)

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		defer m.Record()

		// The apiserver request context carries the authenticated identity that
		// NewDataSourceProxy reads via identity.GetRequester.
		req = req.WithContext(ctx)

		ds, err := loader.DataSource(req.Context())
		if err != nil {
			if errors.Is(err, datasources.ErrDataSourceNotFound) {
				m.SetNotFound()
				responder.Error(r.builder.datasourceResourceInfo.NewNotFound(name))
				return
			}
			m.SetError()
			responder.Error(err)
			return
		}
		jsonData, _ := ds.Spec.JSONData().(map[string]any)
		if err := r.builder.validateDataSourceRequest(ds.Spec.URL(), jsonData, req); err != nil {
			m.SetError()
			responder.Error(apierrors.NewForbidden(r.builder.datasourceResourceInfo.GroupResource(), name, err))
			return
		}

		proxy, err := pluginproxy.NewDataSourceProxy(
			loader,
			r.builder.pluginJSON.Routes,
			pluginproxy.HTTPContext{Req: req, Resp: w},
			proxyPathFromRequest(req, name),
			deps.ProxyCfg,
			deps.HTTPClientProvider,
			deps.OAuthTokenService,
			deps.Tracer,
			deps.Features,
		)
		if err != nil {
			m.SetError()
			responder.Error(err)
			return
		}
		proxy.HandleRequest()
	}), nil
}

// proxyPathFromRequest returns everything after the "<name>/proxy" subresource
// boundary, which is the path that should be forwarded to the datasource.
//
// We anchor on the datasource name to avoid matching a literal "/proxy" that
// the forwarded path itself may contain. The real subresource boundary always
// precedes the forwarded subpath, so the first occurrence is the correct one.
func proxyPathFromRequest(req *http.Request, name string) string {
	_, after, found := strings.Cut(req.URL.EscapedPath(), "/"+name+"/proxy")
	if !found {
		return ""
	}
	return strings.TrimPrefix(after, "/")
}
