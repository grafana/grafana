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

const (
	statusOK        = "ok"
	statusError     = "error"
	statusCancelled = "cancelled"

	endpointCallResource   = "callResource"
	endpointCheckHealth    = "checkHealth"
	endpointCollectMetrics = "collectMetrics"
	endpointQueryData      = "queryData"
)

// NewLoggerMiddleware creates a new plugins.ClientMiddleware that will
// log requests.
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

func (m *LoggerMiddleware) logRequest(ctx context.Context, pluginCtx backend.PluginContext, endpoint string, fn func(ctx context.Context) error) error {
	status := statusOK
	start := time.Now()
	timeBeforePluginRequest := log.TimeSinceStart(ctx, start)
	err := fn(ctx)
	if err != nil {
		status = statusError
		if errors.Is(err, context.Canceled) {
			status = statusCancelled
		}
	}

	logParams := []any{
		"status", status,
		"duration", time.Since(start),
		"pluginId", pluginCtx.PluginID,
		"endpoint", endpoint,
		"eventName", "grafana-data-egress",
		"time_before_plugin_request", timeBeforePluginRequest,
	}

	if pluginCtx.User != nil {
		logParams = append(logParams, "uname", pluginCtx.User.Login)
	}

	traceID := tracing.TraceIDFromContext(ctx, false)
	if traceID != "" {
		logParams = append(logParams, "traceID", traceID)
	}

	if pluginCtx.DataSourceInstanceSettings != nil {
		logParams = append(logParams, "dsName", pluginCtx.DataSourceInstanceSettings.Name)
		logParams = append(logParams, "dsUID", pluginCtx.DataSourceInstanceSettings.UID)
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
	err := m.logRequest(ctx, req.PluginContext, endpointQueryData, func(ctx context.Context) (innerErr error) {
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
