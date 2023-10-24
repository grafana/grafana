package clientmiddleware

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	plog "github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/pluginrequestmeta"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

// NewLoggerMiddleware creates a new plugins.ClientMiddleware that will
// log requests.
func NewLoggerMiddleware(cfg *setting.Cfg, logger plog.Logger, features featuremgmt.FeatureToggles) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		if !cfg.PluginLogBackendRequests {
			return next
		}

		return &LoggerMiddleware{
			next:     next,
			logger:   logger,
			features: features,
		}
	})
}

type LoggerMiddleware struct {
	next     plugins.Client
	logger   plog.Logger
	features featuremgmt.FeatureToggles
}

func (m *LoggerMiddleware) logRequest(ctx context.Context, fn func(ctx context.Context) error) error {
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
		"eventName", "grafana-data-egress",
		"time_before_plugin_request", timeBeforePluginRequest,
	}
	if status == statusError {
		logParams = append(logParams, "error", err)
	}
	if m.features.IsEnabled(featuremgmt.FlagPluginsInstrumentationStatusSource) {
		logParams = append(logParams, "status_source", pluginrequestmeta.StatusSourceFromContext(ctx))
	}
	m.logger.FromContext(ctx).Info("Plugin Request Completed", logParams...)
	return err
}

func (m *LoggerMiddleware) QueryData(ctx context.Context, req *backend.QueryDataRequest) (*backend.QueryDataResponse, error) {
	if req == nil {
		return m.next.QueryData(ctx, req)
	}

	var resp *backend.QueryDataResponse
	err := m.logRequest(ctx, func(ctx context.Context) (innerErr error) {
		resp, innerErr = m.next.QueryData(ctx, req)

		if innerErr != nil {
			return innerErr
		}

		ctxLogger := m.logger.FromContext(ctx)
		for refID, dr := range resp.Responses {
			if dr.Error != nil {
				ctxLogger.Error("Partial data response error", "refID", refID, "error", dr.Error)
			}
		}

		return nil
	})

	return resp, err
}

func (m *LoggerMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	err := m.logRequest(ctx, func(ctx context.Context) (innerErr error) {
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
	err := m.logRequest(ctx, func(ctx context.Context) (innerErr error) {
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
	err := m.logRequest(ctx, func(ctx context.Context) (innerErr error) {
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
