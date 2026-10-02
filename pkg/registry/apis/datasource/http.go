package datasource

import (
	"context"
	"errors"
	"net/http"
	"strconv"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/services/validations"
	"github.com/prometheus/client_golang/prometheus"
	"go.opentelemetry.io/otel/attribute"
	"k8s.io/apiserver/pkg/endpoints/request"
)

// HTTPHandlerOptions contains execution dependencies, not API-server or storage registrations.
// Authentication, authorization and tenant context must be established before calling a handler.
type HTTPHandlerOptions struct {
	Group                string
	PluginID             string
	HandlerOrigin        string
	Client               PluginClient
	PluginContext        func(context.Context, string) (backend.PluginContext, error)
	ContextProvider      PluginContextWrapper
	Datasources          PluginDatasourceProvider
	RequestValidator     validations.DataSourceRequestValidator
	EnableChunkedQueries bool
}

type HTTPHandlers struct {
	options HTTPHandlerOptions
}

func NewHTTPHandlers(o HTTPHandlerOptions) *HTTPHandlers {
	registerSubresourceMetrics(prometheus.DefaultRegisterer)
	return &HTTPHandlers{options: o}
}

// Query, Resource and Health expect the datasource UID in the request's "uid" path value.
func (h *HTTPHandlers) Query(w http.ResponseWriter, r *http.Request) {
	h.serve(w, r, h.query)
}

func (h *HTTPHandlers) Resource(w http.ResponseWriter, r *http.Request) {
	h.serve(w, r, h.resource)
}

func (h *HTTPHandlers) Health(w http.ResponseWriter, r *http.Request) {
	h.serve(w, r, h.health)
}

func (h *HTTPHandlers) Convert(w http.ResponseWriter, r *http.Request) {
	reply := jsonResponder{w: w, r: r, group: h.options.Group}
	result, err := convertQueryDataRequest(r.Context(), r, h.options.Client, h.options.ContextProvider)
	if err != nil {
		reply.Error(err)
		return
	}
	reply.Object(http.StatusOK, result)
}

func (h *HTTPHandlers) Get(w http.ResponseWriter, r *http.Request) {
	reply := jsonResponder{w: w, r: r, group: h.options.Group}
	result, err := h.options.Datasources.GetDataSource(r.Context(), r.PathValue("uid"))
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			err = apierrors.NewNotFound(schema.GroupResource{Group: h.options.Group, Resource: "datasources"}, r.PathValue("uid"))
		}
		reply.Error(err)
		return
	}
	reply.Object(http.StatusOK, result)
}

func (h *HTTPHandlers) List(w http.ResponseWriter, r *http.Request) {
	reply := jsonResponder{w: w, r: r, group: h.options.Group}
	if raw := r.URL.Query().Get("watch"); raw != "" {
		watch, err := strconv.ParseBool(raw)
		if err != nil || watch {
			reply.Error(apierrors.NewBadRequest("watch is not supported"))
			return
		}
	}
	result, err := h.options.Datasources.ListDataSources(r.Context())
	if err != nil {
		reply.Error(err)
		return
	}
	reply.Object(http.StatusOK, result)
}

func (h *HTTPHandlers) serve(w http.ResponseWriter, r *http.Request, prepare func(context.Context, string, httpResponder) (http.Handler, error)) {
	reply := jsonResponder{w: w, r: r, group: h.options.Group}
	handler, err := prepare(r.Context(), r.PathValue("uid"), reply)
	if err != nil {
		reply.Error(err)
		return
	}
	handler.ServeHTTP(w, r)
}

// validateDataSourceRequest applies the legacy HTTP API's outbound request policy
// to both the proxy and health endpoints.
func validateDataSourceRequest(validator validations.DataSourceRequestValidator, dsURL string, jsonData map[string]any, req *http.Request) error {
	if validator == nil {
		return nil
	}
	return validator.Validate(dsURL, jsonData, req)
}

type InstanceSettingsLoader func(ctx context.Context, uid string) (*backend.DataSourceInstanceSettings, error)

// ResolvePluginContext keeps settings lookup and context construction identical for both HTTP servers.
func ResolvePluginContext(ctx context.Context, pluginID, uid string, load InstanceSettingsLoader, provider PluginContextWrapper) (backend.PluginContext, error) {
	ctx, span := tracing.Start(ctx, "datasource.getPluginContext",
		attribute.String("namespace", request.NamespaceValue(ctx)),
		attribute.String("plugin_id", pluginID),
		attribute.String("datasource_uid", uid),
	)
	defer span.End()

	getInstanceCtx, getInstanceSpan := tracing.Start(ctx, "datasource.getPluginContext.getInstanceSettings")
	instance, err := load(getInstanceCtx, uid)
	getInstanceSpan.End()
	if err != nil {
		err = tracing.Error(span, err)
		return backend.PluginContext{}, err
	}

	buildContextCtx, buildContextSpan := tracing.Start(ctx, "datasource.getPluginContext.buildPluginContext")
	pluginCtx, err := provider.PluginContextForDataSource(buildContextCtx, instance)
	buildContextSpan.End()
	if err != nil {
		err = tracing.Error(span, err)
		return backend.PluginContext{}, err
	}
	return pluginCtx, nil
}
