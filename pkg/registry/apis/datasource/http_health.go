package datasource

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	datasource "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources"
	"go.opentelemetry.io/otel/attribute"
)

func (h *HTTPHandlers) health(ctx context.Context, name string, responder httpResponder) (http.Handler, error) {
	namespace := request.NamespaceValue(ctx)
	ctx, connectSpan := tracing.Start(ctx, "datasource.health.connect",
		attribute.String("namespace", namespace),
		attribute.String("plugin_id", h.PluginID),
		attribute.String("datasource_uid", name),
	)
	defer connectSpan.End()

	m := newConnectMetric("health", h.PluginID)

	pluginCtx, err := h.PluginContext(ctx, name)
	if err != nil {
		err = tracing.Error(connectSpan, err)
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			m.SetNotFound()
			m.Record()
			return nil, apierrors.NewNotFound(schema.GroupResource{Group: h.Group, Resource: "datasources"}, name)
		}
		m.SetError()
		m.Record()
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		defer m.Record()
		if h.HandlerOrigin != "" {
			w.Header().Set("X-Grafana-DS-Apiserver", h.HandlerOrigin)
		}

		_, reqSpan := tracing.Start(ctx, "datasource.health.request",
			attribute.String("namespace", namespace),
			attribute.String("plugin_id", h.PluginID),
			attribute.String("datasource_uid", name),
		)
		defer reqSpan.End()

		// Validate the request the same way the legacy /health endpoint does,
		// before reaching out to the datasource.
		var dsURL string
		var jsonData map[string]any
		if settings := pluginCtx.DataSourceInstanceSettings; settings != nil {
			dsURL = settings.URL
			if len(settings.JSONData) > 0 {
				_ = json.Unmarshal(settings.JSONData, &jsonData)
			}
		}
		if err := h.validateRequest(dsURL, jsonData, req); err != nil {
			_ = tracing.Error(reqSpan, err)
			m.SetError()
			responder.Error(apierrors.NewForbidden(schema.GroupResource{Group: h.Group, Resource: "datasources"}, name, err))
			return
		}

		healthCtx := config.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
		healthCtx = contextualMiddlewares(healthCtx)

		checkHealthCtx, checkHealthSpan := tracing.Start(healthCtx, "datasource.health.pluginClient.CheckHealth")
		healthResponse, err := h.Client.CheckHealth(checkHealthCtx, &backend.CheckHealthRequest{
			PluginContext: pluginCtx,
		})
		checkHealthSpan.End()
		if err != nil {
			_ = tracing.Error(reqSpan, err)
			m.SetError()
			responder.Error(err)
			return
		}

		rsp := &datasource.HealthCheckResult{}
		rsp.Code = int(healthResponse.Status)
		rsp.Status = healthResponse.Status.String()
		rsp.Message = healthResponse.Message

		if len(healthResponse.JSONDetails) > 0 {
			err := json.Unmarshal(healthResponse.JSONDetails, &rsp.Details)
			if err != nil {
				_ = tracing.Error(reqSpan, err)
				m.SetError()
				responder.Error(err)
				return
			}
		}

		statusCode := http.StatusOK
		if healthResponse.Status != backend.HealthStatusOk {
			m.SetError()
			statusCode = http.StatusBadRequest
		}
		responder.Object(statusCode, rsp)
	}), nil
}
