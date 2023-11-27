package datasource

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
	"github.com/grafana/grafana/pkg/util/errutil/errhttp"
)

type subResourceREST struct {
	builder *DSAPIBuilder
}

var _ = rest.Connecter(&subResourceREST{})

func (r *subResourceREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *subResourceREST) Destroy() {
}

func (r *subResourceREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subResourceREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subResourceREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	pluginCtx, err := r.builder.getDataSourcePluginContext(ctx, name)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if false {
			body, err := io.ReadAll(req.Body)
			if err != nil {
				klog.Errorf("CallResourceRequest body was malformed: %s", err)
				w.WriteHeader(400)
				_, _ = w.Write([]byte("CallResourceRequest body was malformed"))
				return
			}

			idx := strings.LastIndex(req.URL.Path, "/resource")
			if idx < 0 {
				w.WriteHeader(400)
				_, _ = w.Write([]byte("expected resource path"))
				return
			}
			path := req.URL.Path[idx+len("/resource"):]

			err = r.builder.client.CallResource(ctx, &backend.CallResourceRequest{
				PluginContext: *pluginCtx,
				Path:          path,
				Method:        req.Method,
				Body:          body,
			}, httpresponsesender.New(w))

			if err != nil {
				errhttp.Write(ctx, err, w)
			}
		}

		responder.Error(fmt.Errorf("TODO, resource: " + pluginCtx.PluginID))
	}), nil
}
