package appplugin

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/pluginproxy"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

type subProxyREST struct {
	pluginID             string
	routes               []*plugins.Route
	contextProvider      func(ctx context.Context) (context.Context, backend.PluginContext, error)
	accessControl        ac.AccessControl
	tracer               tracing.Tracer
	features             featuremgmt.FeatureToggles
	pluginProxyTransport *http.Transport

	DataProxyLogging bool // from cfg
	SendUserHeader   bool // from cfg
}

func newProxy(b *AppPluginAPIBuilder) *subProxyREST {
	return &subProxyREST{
		pluginID:         b.pluginJSON.ID,
		routes:           b.pluginJSON.Routes,
		contextProvider:  b.getPluginContext,
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

var _ = rest.Connecter(&subProxyREST{})

func (r *subProxyREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *subProxyREST) Destroy() {}

func (r *subProxyREST) ConnectMethods() []string {
	// List all of them -- they will be hidden from openapi, and the plugin can decide which to implement
	return []string{
		http.MethodGet,
		http.MethodHead,
		http.MethodPost,
		http.MethodPut,
		http.MethodPatch,
		http.MethodDelete,
		http.MethodOptions,
	}
}

func (r *subProxyREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
}

func (r *subProxyREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	if name != apppluginV0.INSTANCE_NAME {
		return nil, k8serrors.NewBadRequest("name can only be: " + apppluginV0.INSTANCE_NAME)
	}
	ns := request.NamespaceValue(ctx)
	if ns == "" {
		return nil, k8serrors.NewBadRequest("missing namespace in connect context")
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ctx, pluginCtx, err := r.contextProvider(request.WithNamespace(req.Context(), ns))
		if err != nil {
			responder.Error(err)
			return
		}
		m := newConnectMetric("proxy", r.pluginID)
		defer m.Record()

		ps := &pluginsettings.DTO{
			OrgID:         pluginCtx.OrgID, // nolint:staticcheck
			PluginID:      r.pluginID,
			PluginVersion: pluginCtx.PluginVersion,
			Enabled:       true,
		}
		if err = json.Unmarshal(pluginCtx.AppInstanceSettings.JSONData, &ps.JSONData); err != nil {
			responder.Error(err)
			return
		}

		proxyReq, proxyPath, err := proxyRequest(ctx, req)
		if err != nil {
			responder.Error(err)
			return
		}

		secureJsonData := func(ctx context.Context) (map[string]string, error) {
			return pluginCtx.AppInstanceSettings.DecryptedSecureJSONData, nil
		}

		p, err := pluginproxy.NewPluginProxy(ps, r.routes,
			proxyReq, w, user,
			proxyPath, r.DataProxyLogging, r.SendUserHeader,
			secureJsonData, r.tracer, r.pluginProxyTransport, r.accessControl, r.features)
		if err != nil {
			responder.Error(fmt.Errorf("failed to create plugin proxy: %w", err))
			return
		}
		p.HandleRequest()
	}), nil
}

func proxyRequest(ctx context.Context, req *http.Request) (*http.Request, string, error) {
	idx := strings.Index(req.URL.Path, "/proxy")
	if idx < 0 {
		return nil, "", fmt.Errorf("expected proxy path") // 400?
	}

	clonedReq := req.Clone(ctx)
	rawURL := strings.TrimLeft(req.URL.Path[idx+len("/proxy"):], "/")

	clonedReq.URL = &url.URL{
		Path:     rawURL,
		RawQuery: clonedReq.URL.RawQuery,
	}

	return clonedReq, rawURL, nil
}
