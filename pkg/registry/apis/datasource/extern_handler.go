package datasource

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"k8s.io/apiserver/pkg/registry/rest"

	datasource "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/web"
)

type externalHTTPHandler struct {
	client PluginProtoClient
}

func ExternalPluginHTTPHandler(client PluginProtoClient) *PluginRequestHandlers {
	h := &externalHTTPHandler{client: client}
	return &PluginRequestHandlers{
		health:   h.health,
		query:    h.query,
		resource: h.resource,
	}
}

func (h *externalHTTPHandler) health(ctx context.Context, pluginCtx backend.PluginContext, responder rest.Responder) (http.Handler, error) {
	healthResponse, err := h.client.CheckHealth(ctx, &pluginv2.CheckHealthRequest{
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

func (h *externalHTTPHandler) query(ctx context.Context, pluginCtx backend.PluginContext, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		dqr := data.QueryDataRequest{}
		err := web.Bind(req, &dqr)
		if err != nil {
			responder.Error(err)
			return
		}

		queries, dsRef, err := legacydata.ToDataSourceQueries(dqr)
		if err != nil {
			responder.Error(err)
			return
		}
		if dsRef != nil && dsRef.UID != pluginCtx.DataSourceInstanceSettings.UID {
			responder.Error(fmt.Errorf("expected query body datasource and request to match"))
			return
		}

		var qs []*pluginv2.DataQuery
		for _, dq := range queries {
			qs = append(qs, backend.ToProto().DataQuery(dq))
		}

		rsp, err := h.client.QueryData(ctx, &pluginv2.QueryDataRequest{
			PluginContext: backend.ToProto().PluginContext(pluginCtx),
			Queries:       qs,
		})
		if err != nil {
			responder.Error(err)
			return
		}

		resp, err := backend.FromProto().QueryDataResponse(rsp)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(query.GetPluginV2ResponseCode(rsp),
			&query.QueryDataResponse{QueryDataResponse: *resp},
		)
	}), nil
}

func (h *externalHTTPHandler) resource(ctx context.Context, pluginCtx backend.PluginContext, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		clonedReq, err := resourceRequest(req)
		if err != nil {
			responder.Error(err)
			return
		}

		body, err := io.ReadAll(req.Body)
		if err != nil {
			responder.Error(err)
			return
		}

		headers := make(map[string]*pluginv2.StringList, len(req.Header))
		for k, values := range req.Header {
			headers[k] = &pluginv2.StringList{Values: values}
		}

		protoStream, err := h.client.CallResource(ctx, &pluginv2.CallResourceRequest{
			PluginContext: backend.ToProto().PluginContext(pluginCtx),
			Path:          clonedReq.URL.Path,
			Method:        req.Method,
			Url:           clonedReq.URL.String(),
			Body:          body,
			Headers:       headers,
		})
		if err != nil {
			responder.Error(err)
			return
		}

		server := httpresponsesender.New(w)
		for {
			protoResp, err := protoStream.Recv()
			if err != nil {
				if errors.Is(err, io.EOF) {
					break
				}

				responder.Error(err)
				return
			}

			if err = server.Send(backend.FromProto().CallResourceResponse(protoResp)); err != nil {
				responder.Error(err)
				return
			}
		}
	}), nil
}
