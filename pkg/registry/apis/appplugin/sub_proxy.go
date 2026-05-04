package appplugin

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins"
)

type subProxyREST struct {
	pluginJSON plugins.JSONData
}

func newProxy(b *AppPluginAPIBuilder) *subProxyREST {
	return &subProxyREST{
		pluginJSON: b.pluginJSON,
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
	m := newConnectMetric("proxy", r.pluginJSON.ID)

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		m.SetError()
		defer m.Record()

		clonedReq, err := proxyRequest(req)
		if err != nil {
			backend.Logger.Error("failed to create proxy request", "error", err)
			m.SetError()
			responder.Error(err)
			return
		}

		// TODO... actually proxy!!!
		_, err = w.Write(fmt.Appendf(nil, "TODO, proxy: %s", clonedReq.URL.Path))
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
