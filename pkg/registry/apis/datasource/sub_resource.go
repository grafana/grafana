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

func (r *subResourceREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	pluginCtx, err := r.builder.getPluginContext(ctx, name)
	if err != nil {
		return nil, err
	}
	ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		body, err := io.ReadAll(req.Body)
		if err != nil {
			responder.Error(err)
			return
		}

		idx := strings.LastIndex(req.URL.Path, "/resource")
		if idx < 0 {
			responder.Error(fmt.Errorf("expected resource path")) // 400?
			return
		}

		path := req.URL.Path[idx+len("/resource"):]
		err = r.builder.client.CallResource(ctx, &backend.CallResourceRequest{
			PluginContext: pluginCtx,
			Path:          path,
			Method:        req.Method,
			Body:          body,
		}, httpresponsesender.New(w))

		if err != nil {
			responder.Error(err)
		}
	}), nil
}
