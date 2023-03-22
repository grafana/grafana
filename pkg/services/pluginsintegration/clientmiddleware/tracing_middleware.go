package clientmiddleware

import (
	"context"
	"net/http"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
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

// traceWrap returns a new context.Context which wraps a newly created span. The span will also contain attributes for
// plugin id, org id and user login. The second function returned is a cleanup function, which should be called by the
// caller (deferred) and will set the span status/error and end the span.
func (m *TracingMiddleware) traceWrap(
	ctx context.Context, pluginContext backend.PluginContext, headers http.Header, opName string,
) (context.Context, func(error)) {
	// Start span
	ctx, span := m.tracer.Start(ctx, "PluginClient."+opName)

	// Attach some plugin context information to span
	span.SetAttributes("plugin_id", pluginContext.PluginID, attribute.String("plugin_id", pluginContext.PluginID))
	span.SetAttributes("org_id", pluginContext.OrgID, attribute.Int64("org_id", pluginContext.OrgID))
	if settings := pluginContext.DataSourceInstanceSettings; settings != nil {
		span.SetAttributes("datasource_name", settings.Name, attribute.Key("datasource_name").String(settings.Name))
		span.SetAttributes("datasource_type", settings.Type, attribute.Key("datasource_type").String(settings.Type))
		span.SetAttributes("datasource_uid", settings.UID, attribute.Key("datasource_uid").String(settings.UID))
	}
	if u := pluginContext.User; u != nil {
		span.SetAttributes("user", u.Login, attribute.String("user", u.Login))
	}

	// Additional attributes from http headers
	if len(headers) > 0 {
		for _, h := range []struct {
			header    string
			attribute string
		}{
			{"X-Panel-Id", "panel_id"},
			{"X-Dashboard-Id", "dashboard_id"},
		} {
			if len(headers[h.header]) == 0 {
				continue
			}
			if v, err := strconv.Atoi(headers[h.header][0]); err == nil {
				span.SetAttributes(h.attribute, v, attribute.Key(h.attribute).Int(v))
			}
		}
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

// httpHeadersFromMap takes a map[string]string and converts it to http.Header (map[string][]string)
func httpHeadersFromMap(m map[string]string) http.Header {
	r := make(http.Header, len(m))
	for k, v := range m {
		r[k] = []string{v}
	}
	return r
}

func (m *TracingMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	ctx, end := m.traceWrap(ctx, req.PluginContext, httpHeadersFromMap(req.Headers), "queryData")
	resp, err := m.next.QueryData(ctx, req)
	end(err)
	return resp, err
}

func (m *TracingMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	ctx, end := m.traceWrap(ctx, req.PluginContext, req.GetHTTPHeaders(), "callResource")
	err := m.next.CallResource(ctx, req, sender)
	end(err)
	return err
}

func (m *TracingMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	ctx, end := m.traceWrap(ctx, req.PluginContext, httpHeadersFromMap(req.Headers), "checkHealth")
	resp, err := m.next.CheckHealth(ctx, req)
	end(err)
	return resp, err
}

func (m *TracingMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	ctx, end := m.traceWrap(ctx, req.PluginContext, nil, "collectMetrics")
	resp, err := m.next.CollectMetrics(ctx, req)
	end(err)
	return resp, err
}

func (m *TracingMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	ctx, end := m.traceWrap(ctx, req.PluginContext, nil, "subscribeStream")
	resp, err := m.next.SubscribeStream(ctx, req)
	end(err)
	return resp, err
}

func (m *TracingMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	ctx, end := m.traceWrap(ctx, req.PluginContext, nil, "publishStream")
	resp, err := m.next.PublishStream(ctx, req)
	end(err)
	return resp, err
}

func (m *TracingMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	ctx, end := m.traceWrap(ctx, req.PluginContext, nil, "runStream")
	err := m.next.RunStream(ctx, req, sender)
	end(err)
	return err
}
