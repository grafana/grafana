package clientmiddleware

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins"
	plog "github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/setting"
)

// NewLoggerMiddleware creates a new plugins.ClientMiddleware that will
// log requests and add a contextual logger to the request context.
func NewLoggerMiddleware(cfg *setting.Cfg, logger plog.Logger) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		if !cfg.PluginLogBackendRequests {
			return next
		}

		return &LoggerMiddleware{
			next:   next,
			logger: logger,
		}
	})
}

type LoggerMiddleware struct {
	next   plugins.Client
	logger plog.Logger
}

// loggerParams returns the logger params for the provided plugin context.
// (pluginId, dsName, dsUID, uname).
func loggerParams(pCtx backend.PluginContext) []any {
	p := []any{"pluginId", pCtx.PluginID}
	if pCtx.DataSourceInstanceSettings != nil {
		p = append(p, "dsName", pCtx.DataSourceInstanceSettings.Name)
		p = append(p, "dsUID", pCtx.DataSourceInstanceSettings.UID)
	}
	if pCtx.User != nil {
		p = append(p, "uname", pCtx.User.Login)
	}
	return p
}

// instrumentContext adds a contextual logger with plugin and request details to the given context.
func instrumentContext(ctx context.Context, endpoint string, pCtx backend.PluginContext) context.Context {
	return log.WithContextualAttributes(ctx, append([]any{"endpoint", endpoint}, loggerParams(pCtx)...))
}

func (m *LoggerMiddleware) logRequest(ctx context.Context, pluginCtx backend.PluginContext, endpoint string, fn func(ctx context.Context) error) error {
	status := statusOK
	start := time.Now()
	timeBeforePluginRequest := log.TimeSinceStart(ctx, start)

	ctx = instrumentContext(ctx, endpoint, pluginCtx)
	err := fn(ctx)
	if err != nil {
		status = statusError
		if errors.Is(err, context.Canceled) {
			status = statusCancelled
		}
	}
	logParams := loggerParams(pluginCtx)
	logParams = append(logParams,
		"endpoint", endpoint,
		"status", status,
		"duration", time.Since(start),
		"eventName", "grafana-data-egress",
		"time_before_plugin_request", timeBeforePluginRequest,
	)
	if traceID := tracing.TraceIDFromContext(ctx, false); traceID != "" {
		logParams = append(logParams, "traceID", traceID)
	}
	if status == statusError {
		logParams = append(logParams, "error", err)
	}
	m.logger.Info("Plugin Request Completed", logParams...)
	return err
}

func (m *LoggerMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	var resp *backend.QueryDataResponse
	err := m.logRequest(ctx, req.PluginContext, endpointQueryData, func(ctx context.Context) (innerErr error) {
		resp, innerErr = m.next.QueryData(ctx, req)
		return innerErr
	})

	return resp, err
}

func (m *LoggerMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	err := m.logRequest(ctx, req.PluginContext, endpointCallResource, func(ctx context.Context) (innerErr error) {
		innerErr = m.next.CallResource(ctx, req, sender)
		return innerErr
	})

	return err
}

func (m *LoggerMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.next.CheckHealth(ctx, req)
	}

	var resp *backend.CheckHealthResult
	err := m.logRequest(ctx, req.PluginContext, endpointCheckHealth, func(ctx context.Context) (innerErr error) {
		resp, innerErr = m.next.CheckHealth(ctx, req)
		return innerErr
	})

	return resp, err
}

func (m *LoggerMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if req == nil {
		return m.next.CollectMetrics(ctx, req)
	}

	var resp *backend.CollectMetricsResult
	err := m.logRequest(ctx, req.PluginContext, endpointCollectMetrics, func(ctx context.Context) (innerErr error) {
		resp, innerErr = m.next.CollectMetrics(ctx, req)
		return innerErr
	})

	return resp, err
}

func (m *LoggerMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	return m.next.SubscribeStream(ctx, req)
}

func (m *LoggerMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	return m.next.PublishStream(ctx, req)
}

func (m *LoggerMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	return m.next.RunStream(ctx, req, sender)
}
