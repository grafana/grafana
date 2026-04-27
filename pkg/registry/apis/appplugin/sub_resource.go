package appplugin

import (
	"context"
	"fmt"
	"io"
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
	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
)

type subResourceREST struct {
	pluginID        string
	client          backend.CallResourceHandler
	contextProvider func(ctx context.Context) (context.Context, backend.PluginContext, error)
}

var _ = rest.Connecter(&subResourceREST{})

func (r *subResourceREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *subResourceREST) Destroy() {
}

func (r *subResourceREST) ConnectMethods() []string {
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

func (r *subResourceREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
}

func (r *subResourceREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
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
		m := newConnectMetric("resource", r.pluginID)
		defer m.Record()

		clonedReq, err := resourceRequest(req)
		if err != nil {
			backend.Logger.Error("failed to create resource request", "error", err)
			m.SetError()
			responder.Error(err)
			return
		}

		body, err := io.ReadAll(req.Body)
		if err != nil {
			backend.Logger.Error("failed to read request body", "error", err)
			m.SetError()
			responder.Error(err)
			return
		}

		err = r.client.CallResource(ctx, &backend.CallResourceRequest{
			PluginContext: pluginCtx,
			Path:          clonedReq.URL.Path,
			Method:        req.Method,
			URL:           clonedReq.URL.String(),
			Body:          body,
			Headers:       req.Header,
		}, httpresponsesender.New(w))

		if err != nil {
			backend.Logger.Error("plugin resource request failed", "error", err)
			m.SetError()
			responder.Error(err)
			return
		}
	}), nil
}

func resourceRequest(req *http.Request) (*http.Request, error) {
	idx := strings.LastIndex(req.URL.Path, "/resources")
	if idx < 0 {
		return nil, fmt.Errorf("expected resource path") // 400?
	}

	clonedReq := req.Clone(req.Context())
	rawURL := strings.TrimLeft(req.URL.Path[idx+len("/resources"):], "/")

	clonedReq.URL = &url.URL{
		Path:     rawURL,
		RawQuery: clonedReq.URL.RawQuery,
	}

	return clonedReq, nil
}
