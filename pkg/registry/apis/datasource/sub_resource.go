package datasource

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
	"github.com/grafana/grafana/pkg/services/datasources"
	"go.opentelemetry.io/otel/attribute"
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
	ctx, connectSpan := tracing.Start(ctx, "datasource.resource.connect",
		attribute.String("plugin_id", r.builder.pluginJSON.ID),
		attribute.String("datasource_uid", name),
	)
	defer connectSpan.End()

	m := newConnectMetric("resource", r.builder.pluginJSON.ID)

	pluginCtx, err := r.builder.getPluginContext(ctx, name)
	if err != nil {
		err = tracing.Error(connectSpan, err)
		backend.Logger.Error("failed to get plugin context for datasource in resource handler", "name", name, "error", err)
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			m.SetNotFound()
			m.Record()
			return nil, r.builder.datasourceResourceInfo.NewNotFound(name)
		}
		m.SetError()
		m.Record()
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		defer m.Record()

		reqCtx, reqSpan := tracing.Start(ctx, "datasource.resource.request",
			attribute.String("plugin_id", r.builder.pluginJSON.ID),
			attribute.String("datasource_uid", name),
			attribute.String("http_method", req.Method),
		)
		defer reqSpan.End()

		callCtx := config.WithGrafanaConfig(reqCtx, pluginCtx.GrafanaConfig)
		callCtx = contextualMiddlewares(callCtx)

		_, cloneSpan := tracing.Start(reqCtx, "datasource.resource.normalizeRequest")
		clonedReq, err := resourceRequest(req)
		cloneSpan.End()
		if err != nil {
			_ = tracing.Error(reqSpan, err)
			backend.Logger.Error("failed to create resource request", "error", err)
			m.SetError()
			responder.Error(err)
			return
		}

		_, readBodySpan := tracing.Start(reqCtx, "datasource.resource.readRequestBody")
		body, err := io.ReadAll(req.Body)
		readBodySpan.End()
		if err != nil {
			_ = tracing.Error(reqSpan, err)
			backend.Logger.Error("failed to read request body", "error", err)
			m.SetError()
			responder.Error(err)
			return
		}

		resourceCtx, resourceSpan := tracing.Start(callCtx, "datasource.resource.pluginClient.CallResource",
			attribute.String("plugin_resource_path", clonedReq.URL.Path),
		)
		err = r.builder.client.CallResource(resourceCtx, &backend.CallResourceRequest{
			PluginContext: pluginCtx,
			Path:          clonedReq.URL.Path,
			Method:        req.Method,
			URL:           clonedReq.URL.String(),
			Body:          body,
			Headers:       req.Header,
		}, httpresponsesender.New(w))
		resourceSpan.End()

		if err != nil {
			_ = tracing.Error(reqSpan, err)
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
