package appsettings

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"

	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	gaprequest "github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginroute/routemux"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

// SettingsReader reads the settings a proxied request's route templates are
// filled in from, with a loader for their decrypted secure values.
type SettingsReader func(ctx context.Context) (*apppluginV0.Settings, pluginsettings.DecryptedSecureJSONLoader, error)

// proxyHandler serves the proxy routes the settings manifest declares, and
// forwards each request with the route it matched.
type proxyHandler struct {
	pluginID             string
	mux                  http.Handler
	settings             SettingsReader
	accessControl        ac.AccessControl
	tracer               tracing.Tracer
	features             featuremgmt.FeatureToggles
	pluginProxyTransport *http.Transport

	DataProxyLogging bool // from cfg
	SendUserHeader   bool // from cfg
}

func newProxy(b *Builder, routes *proxyRoutes) *proxyHandler {
	p := &proxyHandler{
		pluginID:         b.group, // the settings API is served under the plugin ID
		settings:         b.getSettings,
		accessControl:    b.opts.AccessControl,
		DataProxyLogging: b.opts.DataProxyLogging,
		SendUserHeader:   b.opts.SendUserHeader,
		tracer:           b.tracer,
		features:         b.features,

		pluginProxyTransport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: b.opts.PluginsAppsSkipVerifyTLS,
				MinVersion:         tls.VersionTLS13,
			},
			Proxy: http.ProxyFromEnvironment,
			DialContext: (&net.Dialer{
				Timeout:   30 * time.Second,
				KeepAlive: 30 * time.Second,
			}).DialContext,
			TLSHandshakeTimeout: 10 * time.Second,
		},
	}
	// A request no route matches is answered as the plugin proxy answers one
	// that matches none of its routes.
	unmatched := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { p.forward(w, r, nil) })
	p.mux = routemux.Wrap(b.group, []routemux.Version{routes.version}, routes.handler(p.forward), unmatched, nil)
	return p
}

func (r *proxyHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	r.mux.ServeHTTP(w, req)
}

// forward forwards a request with the first of routes that matches it, or
// answers 404 when none does.
func (r *proxyHandler) forward(w http.ResponseWriter, req *http.Request, routes []*plugins.Route) {
	ctx := req.Context()
	ns, err := gaprequest.NamespaceInfoFrom(ctx, true)
	if err != nil {
		_ = errhttp.Write(ctx, k8serrors.NewBadRequest("missing namespace"), w)
		return
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		_ = errhttp.Write(ctx, err, w)
		return
	}

	settings, secure, err := r.settings(ctx)
	if err != nil {
		_ = errhttp.Write(ctx, err, w)
		return
	}
	m := newSubresourceMetric("proxy", r.pluginID)
	defer m.Record()

	ps := &pluginsettings.DTO{
		OrgID:    ns.OrgID, // will be 1 in cloud
		PluginID: r.pluginID,
		Enabled:  true,
		JSONData: settings.Spec.JsonData.Object,
	}

	proxyReq, proxyPath, err := proxyRequest(ctx, req)
	if err != nil {
		_ = errhttp.Write(ctx, err, w)
		return
	}

	p, err := pluginproxy.NewPluginProxy(ps, routes,
		proxyReq, w, user,
		proxyPath, r.DataProxyLogging, r.SendUserHeader,
		secure, r.tracer, r.pluginProxyTransport, r.accessControl, r.features, nil)
	if err != nil {
		_ = errhttp.Write(ctx, fmt.Errorf("failed to create plugin proxy: %w", err), w)
		return
	}
	p.HandleRequest()
}

func proxyRequest(ctx context.Context, req *http.Request) (*http.Request, string, error) {
	const slug = "/app/instance/proxy"
	idx := strings.Index(req.URL.Path, slug)
	if idx < 0 {
		return nil, "", fmt.Errorf("expected proxy path") // 400?
	}

	clonedReq := req.Clone(ctx)
	rawURL := strings.TrimLeft(req.URL.Path[idx+len(slug):], "/")

	clonedReq.URL = &url.URL{
		Path:     rawURL,
		RawQuery: clonedReq.URL.RawQuery,
	}

	return clonedReq, rawURL, nil
}
