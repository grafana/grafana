package datasource

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
	"github.com/grafana/grafana/pkg/services/datasources"
	"go.opentelemetry.io/otel/attribute"
)

func (h *HTTPHandlers) resource(ctx context.Context, name string, responder httpResponder) (http.Handler, error) {
	namespace := request.NamespaceValue(ctx)
	ctx, connectSpan := tracing.Start(ctx, "datasource.resource.connect",
		attribute.String("namespace", namespace),
		attribute.String("plugin_id", h.options.PluginID),
		attribute.String("datasource_uid", name),
	)
	defer connectSpan.End()

	m := newConnectMetric("resource", h.options.PluginID)

	pluginCtx, err := h.options.PluginContext(ctx, name)
	if err != nil {
		err = tracing.Error(connectSpan, err)
		backend.Logger.Error("failed to get plugin context for datasource in resource handler", "name", name, "error", err)
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			m.SetNotFound()
			m.Record()
			return nil, apierrors.NewNotFound(schema.GroupResource{Group: h.options.Group, Resource: "datasources"}, name)
		}
		m.SetError()
		m.Record()
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		defer m.Record()
		if h.options.HandlerOrigin != "" {
			w.Header().Set("X-Grafana-DS-Apiserver", h.options.HandlerOrigin)
		}

		reqCtx, reqSpan := tracing.Start(ctx, "datasource.resource.request",
			attribute.String("namespace", namespace),
			attribute.String("plugin_id", h.options.PluginID),
			attribute.String("datasource_uid", name),
			attribute.String("http_method", req.Method),
		)
		defer reqSpan.End()

		callCtx := config.WithGrafanaConfig(reqCtx, pluginCtx.GrafanaConfig)
		callCtx = contextualMiddlewares(callCtx)

		_, cloneSpan := tracing.Start(reqCtx, "datasource.resource.normalizeRequest")
		clonedReq, err := resourceRequest(req, name)
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
			responder.Error(RequestError(err))
			return
		}

		resourceCtx, resourceSpan := tracing.Start(callCtx, "datasource.resource.pluginClient.CallResource",
			attribute.String("plugin_resource_path", clonedReq.URL.Path),
		)
		err = h.options.Client.CallResource(resourceCtx, &backend.CallResourceRequest{
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

func resourceRequest(req *http.Request, name string) (*http.Request, error) {
	// Anchor on the "<name>/resources" subresource boundary rather than a bare
	// "/resources" so a forwarded path that itself contains "/resources" is not
	// split at the wrong place. The real boundary always precedes the forwarded
	// subpath, so the first occurrence is the correct one.
	_, after, found := strings.Cut(req.URL.Path, "/"+name+"/resources")
	if !found {
		return nil, apierrors.NewBadRequest("expected resource path")
	}

	clonedReq := req.Clone(req.Context())
	clonedReq.URL = &url.URL{
		Path:     strings.TrimPrefix(after, "/"),
		RawQuery: clonedReq.URL.RawQuery,
	}

	return clonedReq, nil
}
