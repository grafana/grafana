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
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
	"github.com/grafana/grafana/pkg/util/errhttp"
)

type proxyHandler struct {
	pluginID             string
	routes               []*plugins.Route
	settingsProvider     func(ctx context.Context) (*apppluginV0.Settings, pluginsettings.DecryptedSecureJSONLoader, error)
	accessControl        ac.AccessControl
	tracer               tracing.Tracer
	features             featuremgmt.FeatureToggles
	pluginProxyTransport *http.Transport

	DataProxyLogging bool // from cfg
	SendUserHeader   bool // from cfg
}

func newProxy(b *Builder) *proxyHandler {
	return &proxyHandler{
		pluginID:         b.pluginJSON.ID,
		routes:           b.pluginJSON.Routes,
		settingsProvider: b.getSettings,
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
}

func (r *proxyHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
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

	settings, secure, err := r.settingsProvider(ctx)
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

	// The derive-id-token fallback is only wired for the datasource group today (see
	// pkg/extensions/apiserver/factory.go); app plugin proxying doesn't need it in ST,
	// where the edge still mints an id token for every requester.
	p, err := pluginproxy.NewPluginProxy(ps, r.routes,
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
