package clientmiddleware

import (
	"context"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/query"
)

// NewTracingMiddleware returns a new middleware that creates a new span on every method call.
func NewTracingMiddleware(tracer tracing.Tracer) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &TracingMiddleware{
			tracer: tracer,
			next:   next,
		}
	})
}

type TracingMiddleware struct {
	tracer tracing.Tracer
	next   plugins.Client
}

// setSpanAttributeFromHTTPHeader takes a ReqContext and a span, and adds the specified HTTP header as a span attribute
// (string value), if the header is present.
func setSpanAttributeFromHTTPHeader(headers http.Header, span trace.Span, attributeName, headerName string) {
	// Set the attribute as string
	if v := headers.Get(headerName); v != "" {
		span.SetAttributes(attribute.String(attributeName, v))
	}
}

// traceWrap returns a new context.Context which wraps a newly created span. The span will also contain attributes for
// plugin id, org id, user login, ds, dashboard and panel info. The second function returned is a cleanup function,
// which should be called by the caller (deferred) and will set the span status/error and end the span.
func (m *TracingMiddleware) traceWrap(
	ctx context.Context, pluginContext backend.PluginContext, opName string,
) (context.Context, func(error)) {
	// Start span
	ctx, span := m.tracer.Start(ctx, "PluginClient."+opName, trace.WithAttributes(
		// Attach some plugin context information to span
		attribute.String("plugin_id", pluginContext.PluginID),
		attribute.Int64("org_id", pluginContext.OrgID),
	))

	if settings := pluginContext.DataSourceInstanceSettings; settings != nil {
		span.SetAttributes(attribute.String("datasource_name", settings.Name))
		span.SetAttributes(attribute.String("datasource_uid", settings.UID))
	}
	if u := pluginContext.User; u != nil {
		span.SetAttributes(attribute.String("user", u.Login))
	}

	// Additional attributes from http headers
	if reqCtx := contexthandler.FromContext(ctx); reqCtx != nil && reqCtx.Req != nil && len(reqCtx.Req.Header) > 0 {
		if v, err := strconv.Atoi(reqCtx.Req.Header.Get(query.HeaderPanelID)); err == nil {
			span.SetAttributes(attribute.Int("panel_id", v))
		}
		setSpanAttributeFromHTTPHeader(reqCtx.Req.Header, span, "query_group_id", query.HeaderQueryGroupID)
		setSpanAttributeFromHTTPHeader(reqCtx.Req.Header, span, "dashboard_uid", query.HeaderDashboardUID)
	}

	// Return ctx with span + cleanup func
	return ctx, func(err error) {
		if err != nil {
			span.SetStatus(codes.Error, err.Error())
			span.RecordError(err)
		}
		span.End()
	}
}

func (m *TracingMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	var err error
	ctx, end := m.traceWrap(ctx, req.PluginContext, "queryData")
	defer func() { end(err) }()
	resp, err := m.next.QueryData(ctx, req)
	return resp, err
}

func (m *TracingMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	var err error
	ctx, end := m.traceWrap(ctx, req.PluginContext, "callResource")
	defer func() { end(err) }()
	err = m.next.CallResource(ctx, req, sender)
	return err
}

func (m *TracingMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	var err error
	ctx, end := m.traceWrap(ctx, req.PluginContext, "checkHealth")
	defer func() { end(err) }()
	resp, err := m.next.CheckHealth(ctx, req)
	return resp, err
}

func (m *TracingMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	var err error
	ctx, end := m.traceWrap(ctx, req.PluginContext, "collectMetrics")
	defer func() { end(err) }()
	resp, err := m.next.CollectMetrics(ctx, req)
	return resp, err
}

func (m *TracingMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	var err error
	ctx, end := m.traceWrap(ctx, req.PluginContext, "subscribeStream")
	defer func() { end(err) }()
	resp, err := m.next.SubscribeStream(ctx, req)
	return resp, err
}

func (m *TracingMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	var err error
	ctx, end := m.traceWrap(ctx, req.PluginContext, "publishStream")
	defer func() { end(err) }()
	resp, err := m.next.PublishStream(ctx, req)
	return resp, err
}

func (m *TracingMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	var err error
	ctx, end := m.traceWrap(ctx, req.PluginContext, "runStream")
	defer func() { end(err) }()
	err = m.next.RunStream(ctx, req, sender)
	return err
}

// ValidateAdmission implements backend.AdmissionHandler.
func (m *TracingMiddleware) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	var err error
	ctx, end := m.traceWrap(ctx, req.PluginContext, endpointValidateAdmission)
	defer func() { end(err) }()
	resp, err := m.next.ValidateAdmission(ctx, req)
	return resp, err
}

// MutateAdmission implements backend.AdmissionHandler.
func (m *TracingMiddleware) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	var err error
	ctx, end := m.traceWrap(ctx, req.PluginContext, endpointMutateAdmission)
	defer func() { end(err) }()
	resp, err := m.next.MutateAdmission(ctx, req)
	return resp, err
}

// ConvertObject implements backend.AdmissionHandler.
func (m *TracingMiddleware) ConvertObject(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	var err error
	ctx, end := m.traceWrap(ctx, req.PluginContext, endpointConvertObject)
	defer func() { end(err) }()
	resp, err := m.next.ConvertObject(ctx, req)
	return resp, err
}
