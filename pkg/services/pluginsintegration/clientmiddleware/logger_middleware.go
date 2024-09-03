package clientmiddleware

import (
	"context"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/instrumentationutils"
	plog "github.com/grafana/grafana/pkg/plugins/log"
	"github.com/grafana/grafana/pkg/plugins/manager/registry"
	"github.com/grafana/grafana/pkg/plugins/pluginrequestmeta"
)

// NewLoggerMiddleware creates a new plugins.ClientMiddleware that will
// log requests.
func NewLoggerMiddleware(logger plog.Logger, pluginRegistry registry.Service) plugins.ClientMiddleware {
	return plugins.ClientMiddlewareFunc(func(next plugins.Client) plugins.Client {
		return &LoggerMiddleware{
			baseMiddleware: baseMiddleware{
				next: next,
			},
			logger:         logger,
			pluginRegistry: pluginRegistry,
		}
	})
}

type LoggerMiddleware struct {
	baseMiddleware
	logger         plog.Logger
	pluginRegistry registry.Service
}

func (m *LoggerMiddleware) pluginTarget(ctx context.Context, pCtx backend.PluginContext) string {
	p, exists := m.pluginRegistry.Plugin(ctx, pCtx.PluginID, pCtx.PluginVersion)
	if !exists {
		return ""
	}
	return string(p.Target())
}

func (m *LoggerMiddleware) logRequest(ctx context.Context, pCtx backend.PluginContext, fn func(ctx context.Context) (instrumentationutils.RequestStatus, error)) error {
	start := time.Now()
	timeBeforePluginRequest := log.TimeSinceStart(ctx, start)

	status, err := fn(ctx)
	logParams := []any{
		"status", status.String(),
		"duration", time.Since(start),
		"eventName", "grafana-data-egress",
		"time_before_plugin_request", timeBeforePluginRequest,
		"target", m.pluginTarget(ctx, pCtx),
	}
	if err != nil {
		logParams = append(logParams, "error", err)
	}
	logParams = append(logParams, "statusSource", pluginrequestmeta.StatusSourceFromContext(ctx))

	ctxLogger := m.logger.FromContext(ctx)
	logFunc := ctxLogger.Info
	if status > instrumentationutils.RequestStatusOK {
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
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.next.QueryData(ctx, req)

		if innerErr != nil {
			return instrumentationutils.RequestStatusFromError(innerErr), innerErr
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

		return instrumentationutils.RequestStatusFromQueryDataResponse(resp, innerErr), innerErr
	})

	return resp, err
}

func (m *LoggerMiddleware) CallResource(ctx context.Context, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	if req == nil {
		return m.next.CallResource(ctx, req, sender)
	}

	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		innerErr := m.next.CallResource(ctx, req, sender)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})

	return err
}

func (m *LoggerMiddleware) CheckHealth(ctx context.Context, req *backend.CheckHealthRequest) (*backend.CheckHealthResult, error) {
	if req == nil {
		return m.next.CheckHealth(ctx, req)
	}

	var resp *backend.CheckHealthResult
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.next.CheckHealth(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *LoggerMiddleware) CollectMetrics(ctx context.Context, req *backend.CollectMetricsRequest) (*backend.CollectMetricsResult, error) {
	if req == nil {
		return m.next.CollectMetrics(ctx, req)
	}

	var resp *backend.CollectMetricsResult
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.next.CollectMetrics(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *LoggerMiddleware) SubscribeStream(ctx context.Context, req *backend.SubscribeStreamRequest) (*backend.SubscribeStreamResponse, error) {
	if req == nil {
		return m.next.SubscribeStream(ctx, req)
	}

	var resp *backend.SubscribeStreamResponse
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.next.SubscribeStream(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *LoggerMiddleware) PublishStream(ctx context.Context, req *backend.PublishStreamRequest) (*backend.PublishStreamResponse, error) {
	if req == nil {
		return m.next.PublishStream(ctx, req)
	}

	var resp *backend.PublishStreamResponse
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.next.PublishStream(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *LoggerMiddleware) RunStream(ctx context.Context, req *backend.RunStreamRequest, sender *backend.StreamSender) error {
	if req == nil {
		return m.next.RunStream(ctx, req, sender)
	}

	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		innerErr := m.next.RunStream(ctx, req, sender)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})

	return err
}

func (m *LoggerMiddleware) ValidateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.ValidationResponse, error) {
	if req == nil {
		return m.next.ValidateAdmission(ctx, req)
	}

	var resp *backend.ValidationResponse
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.next.ValidateAdmission(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *LoggerMiddleware) MutateAdmission(ctx context.Context, req *backend.AdmissionRequest) (*backend.MutationResponse, error) {
	if req == nil {
		return m.next.MutateAdmission(ctx, req)
	}

	var resp *backend.MutationResponse
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.next.MutateAdmission(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}

func (m *LoggerMiddleware) ConvertObjects(ctx context.Context, req *backend.ConversionRequest) (*backend.ConversionResponse, error) {
	if req == nil {
		return m.next.ConvertObjects(ctx, req)
	}

	var resp *backend.ConversionResponse
	err := m.logRequest(ctx, req.PluginContext, func(ctx context.Context) (instrumentationutils.RequestStatus, error) {
		var innerErr error
		resp, innerErr = m.next.ConvertObjects(ctx, req)
		return instrumentationutils.RequestStatusFromError(innerErr), innerErr
	})

	return resp, err
}
