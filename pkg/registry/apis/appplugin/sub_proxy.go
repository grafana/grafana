package appplugin

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
)

type subProxyREST struct {
	pluginID        string
	routes          []*plugins.Route
	contextProvider func(ctx context.Context) (context.Context, backend.PluginContext, error)
	accessControl   ac.AccessControl
}

func newProxy(b *AppPluginAPIBuilder) *subProxyREST {
	return &subProxyREST{
		pluginID:        b.pluginJSON.ID,
		routes:          b.pluginJSON.Routes,
		contextProvider: b.getPluginContext,
		accessControl:   b.opts.AccessControl,
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

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		ctx, pluginCtx, err := r.contextProvider(request.WithNamespace(req.Context(), ns))
		if err != nil {
			responder.Error(err)
			return
		}
		m := newConnectMetric("proxy", r.pluginID)
		defer m.Record()

		clonedReq, err := proxyRequest(req)
		if err != nil {
			backend.Logger.Error("failed to create proxy request", "error", err)
			m.SetError()
			responder.Error(err)
			return
		}

		// TODO... actually proxy!!!
		_, err = w.Write(fmt.Appendf(nil, "TODO, proxy: %s // %v // %v", clonedReq.URL.Path, pluginCtx.AppInstanceSettings.JSONData, ctx))
		if err != nil {
			responder.Error(err)
		}
	}), nil
}

func proxyRequest(req *http.Request) (*http.Request, error) {
	idx := strings.LastIndex(req.URL.Path, "/proxy")
	if idx < 0 {
		return nil, fmt.Errorf("expected proxy path") // 400?
	}

	clonedReq := req.Clone(req.Context())
	rawURL := strings.TrimLeft(req.URL.Path[idx+len("/proxy"):], "/")

	clonedReq.URL = &url.URL{
		Path:     rawURL,
		RawQuery: clonedReq.URL.RawQuery,
	}

	return clonedReq, nil
}
