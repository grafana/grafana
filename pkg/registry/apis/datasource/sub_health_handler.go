package datasource

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"k8s.io/apiserver/pkg/registry/rest"

	datasource "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
)

type CorePluginHealthHandler struct {
	client PluginClient
}

func NewCorePluginHealthHandler(client PluginClient) *CorePluginHealthHandler {
	return &CorePluginHealthHandler{
		client: client,
	}
}

func (r *CorePluginHealthHandler) Handle(ctx context.Context, pluginCtx backend.PluginContext, responder rest.Responder) (http.Handler, error) {
	ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
	ctx = contextualMiddlewares(ctx)

	healthResponse, err := r.client.CheckHealth(ctx, &backend.CheckHealthRequest{
		PluginContext: pluginCtx,
	})
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		rsp := &datasource.HealthCheckResult{}
		rsp.Code = int(healthResponse.Status)
		rsp.Status = healthResponse.Status.String()
		rsp.Message = healthResponse.Message

		if len(healthResponse.JSONDetails) > 0 {
			err = json.Unmarshal(healthResponse.JSONDetails, &rsp.Details)
			if err != nil {
				responder.Error(err)
				return
			}
		}

		statusCode := http.StatusOK
		if healthResponse.Status != backend.HealthStatusOk {
			statusCode = http.StatusBadRequest
		}
		responder.Object(statusCode, rsp)
	}), nil
}

type ExternalPluginHealthHandler struct {
	client PluginProtoClient
}

func NewExternalPluginHealthHandler(client PluginProtoClient) *ExternalPluginHealthHandler {
	return &ExternalPluginHealthHandler{
		client: client,
	}
}

func (r *ExternalPluginHealthHandler) Handle(ctx context.Context, pluginCtx backend.PluginContext, responder rest.Responder) (http.Handler, error) {
	ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
	ctx = contextualMiddlewares(ctx)

	healthResponse, err := r.client.CheckHealth(ctx, &pluginv2.CheckHealthRequest{
		PluginContext: backend.ToProto().PluginContext(pluginCtx),
	})
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		rsp := &datasource.HealthCheckResult{}
		rsp.Code = int(healthResponse.Status)
		rsp.Status = healthResponse.Status.String()
		rsp.Message = healthResponse.Message

		if len(healthResponse.JsonDetails) > 0 {
			err = json.Unmarshal(healthResponse.JsonDetails, &rsp.Details)
			if err != nil {
				responder.Error(err)
				return
			}
		}

		statusCode := http.StatusOK
		if healthResponse.Status != pluginv2.CheckHealthResponse_OK {
			statusCode = http.StatusBadRequest
		}
		responder.Object(statusCode, rsp)
	}), nil
}
