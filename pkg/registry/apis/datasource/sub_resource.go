package datasource

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
)

type subResourceREST struct {
	builder *DataSourceAPIBuilder
}

var _ = rest.Connecter(&subResourceREST{})

func (r *subResourceREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *subResourceREST) Destroy() {
}

func (r *subResourceREST) ConnectMethods() []string {
	// All for now??? ideally we have a schema for resource and limit this
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

// FIXME: this endpoint has not been tested yet, so it is not enabled by default.
// It is especially important to make sure the `ClearAuthHeadersMiddleware` is active,
// when using this endpoint.
var resourceEnabled = false

func (r *subResourceREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	if !resourceEnabled {
		return nil, &apierrors.StatusError{
			ErrStatus: metav1.Status{
				Status: metav1.StatusFailure,
				Code:   http.StatusNotImplemented,
			},
		}
	}

	pluginCtx, err := r.builder.getPluginContext(ctx, name)
	if err != nil {
		return nil, err
	}
	ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
	ctx = contextualMiddlewares(ctx)

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		clonedReq, err := resourceRequest(req)
		if err != nil {
			responder.Error(err)
			return
		}

		body, err := io.ReadAll(req.Body)
		if err != nil {
			responder.Error(err)
			return
		}

		err = r.builder.client.CallResource(ctx, &backend.CallResourceRequest{
			PluginContext: pluginCtx,
			Path:          clonedReq.URL.Path,
			Method:        req.Method,
			URL:           clonedReq.URL.String(),
			Body:          body,
			Headers:       req.Header,
		}, httpresponsesender.New(w))

		if err != nil {
			responder.Error(err)
		}
	}), nil
}

func resourceRequest(req *http.Request) (*http.Request, error) {
	idx := strings.LastIndex(req.URL.Path, "/resource")
	if idx < 0 {
		return nil, fmt.Errorf("expected resource path") // 400?
	}

	clonedReq := req.Clone(req.Context())
	rawURL := strings.TrimLeft(req.URL.Path[idx+len("/resource"):], "/")

	clonedReq.URL = &url.URL{
		Path:     rawURL,
		RawQuery: clonedReq.URL.RawQuery,
	}

	return clonedReq, nil
}
