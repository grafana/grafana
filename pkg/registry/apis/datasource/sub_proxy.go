package datasource

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"
	"time"

	sdkhttpclient "github.com/grafana/grafana-plugin-sdk-go/backend/httpclient"

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
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/grafana/grafana/pkg/setting"
)

// ProxyDependencies bundles the proxy-only services the datasource frontend
// proxy needs. It is wired as a single dependency so RegisterAPIService doesn't
// have to thread each one through its signature. MT resolves the configuration
// and request validator for the current tenant before constructing the proxy.
type ProxyDependencies struct {
	RequestValidator validations.DataSourceRequestValidator
	// Resolve supplies tenant- and request-specific dependencies in MT.
	Resolve            func(context.Context, *http.Request) (*ProxyDependencies, error)
	RouteAccessChecker pluginproxy.RouteAccessChecker
	ProxyCfg           *pluginproxy.DataSourceProxySettings
	HTTPClientProvider httpclient.Provider
	// TransportConfigKey changes when provider configuration changes between requests.
	TransportConfigKey string
	TimeoutDefaults    *sdkhttpclient.TimeoutOptions
	OAuthTokenService  pluginproxy.OAuthTokenProvider
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
	builder    *DataSourceAPIBuilder
	cacheOnce  sync.Once
	transports *proxyTransportCache
}

var _ = rest.Connecter(&subProxyREST{})

func (r *subProxyREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *subProxyREST) Destroy() {
	r.transportCache().close()
}

func (r *subProxyREST) transportCache() *proxyTransportCache {
	r.cacheOnce.Do(func() { r.transports = newProxyTransportCache(256, 5*time.Minute) })
	return r.transports
}

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
		if r.builder.cfg.HandlerOrigin != "" {
			w.Header().Set("X-Grafana-DS-Apiserver", r.builder.cfg.HandlerOrigin)
		}

		// The apiserver request context carries the authenticated identity that
		// NewDataSourceProxy reads via identity.GetRequester.
		req = req.WithContext(ctx)
		deps := deps
		if deps.Resolve != nil {
			var err error
			deps, err = deps.Resolve(ctx, req)
			if err != nil {
				m.SetError()
				responder.Error(err)
				return
			}
		}
		loader.transports = r.transportCache()
		loader.transportConfigKey = deps.TransportConfigKey
		loader.timeoutDefaults = deps.TimeoutDefaults

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
		validate := r.builder.validateDataSourceRequest
		if deps.RequestValidator != nil {
			validate = deps.RequestValidator.Validate
		}
		if err := validate(ds.Spec.URL(), jsonData, req); err != nil {
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
			pluginproxy.WithRouteAccessChecker(deps.RouteAccessChecker),
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
