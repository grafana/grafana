package clientmiddleware

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	plog "github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/pluginrequestmeta"
)

// NewLoggerMiddleware creates a new plugins.ClientMiddleware that will
// log requests.
func NewLoggerMiddleware(logger plog.Logger) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
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

func (m *LoggerMiddleware) logRequest(ctx context.Context, fn func(ctx context.Context) (requestStatus, error)) error {
	start := time.Now()
	timeBeforePluginRequest := log.TimeSinceStart(ctx, start)

	status, err := fn(ctx)
	logParams := []any{
		"status", status,
		"duration", time.Since(start),
		"eventName", "grafana-data-egress",
		"time_before_plugin_request", timeBeforePluginRequest,
	}
	if err != nil {
		logParams = append(logParams, "error", err)
	}
	logParams = append(logParams, "statusSource", pluginrequestmeta.StatusSourceFromContext(ctx))

	ctxLogger := m.logger.FromContext(ctx)
	logFunc := ctxLogger.Info
	if status > requestStatusOK {
		logFunc = ctxLogger.Error
	}

	logFunc("Plugin Request Completed", logParams...)

	return err
}

func (m *LoggerMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	var resp *backend.QueryDataResponse
	err := m.logRequest(ctx, func(ctx context.Context) (status requestStatus, innerErr error) {
		resp, innerErr = m.next.QueryData(ctx, req)

		if innerErr != nil {
			return requestStatusFromError(innerErr), innerErr
		}

		ctxLogger := m.logger.FromContext(ctx)
		for refID, dr := range resp.Responses {
			if dr.Error != nil {
				logParams := []any{
					"refID", refID,
					"status", int(dr.Status),
					"error", dr.Error,
					"statusSource", pluginrequestmeta.StatusSourceFromPluginErrorSource(dr.ErrorSource),
				}
				ctxLogger.Error("Partial data response error", logParams...)
			}
		}

		return requestStatusFromQueryDataResponse(resp, innerErr), innerErr
	})

	return resp, err
}

func (m *LoggerMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	err := m.logRequest(ctx, func(ctx context.Context) (status requestStatus, innerErr error) {
		innerErr = m.next.CallResource(ctx, req, sender)
		return requestStatusFromError(innerErr), innerErr
	})

	return err
}

func (m *LoggerMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.next.CheckHealth(ctx, req)
	}

	var resp *backend.CheckHealthResult
	err := m.logRequest(ctx, func(ctx context.Context) (status requestStatus, innerErr error) {
		resp, innerErr = m.next.CheckHealth(ctx, req)
		return requestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *LoggerMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if req == nil {
		return m.next.CollectMetrics(ctx, req)
	}

	var resp *backend.CollectMetricsResult
	err := m.logRequest(ctx, func(ctx context.Context) (status requestStatus, innerErr error) {
		resp, innerErr = m.next.CollectMetrics(ctx, req)
		return requestStatusFromError(innerErr), innerErr
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
