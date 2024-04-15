package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"k8s.io/apiserver/pkg/registry/rest"

	datasource "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/plugins/httpresponsesender"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/web"
)

type coreHTTPHandler struct {
	client PluginClient
}

func CorePluginHTTPHandler(client PluginClient) *PluginRequestHandlers {
	h := coreHTTPHandler{client: client}
	return &PluginRequestHandlers{
		health:   h.health,
		query:    h.query,
		resource: h.resource,
	}
}

func (h *coreHTTPHandler) health(ctx context.Context, pluginCtx backend.PluginContext, responder rest.Responder) (http.Handler, error) {
	healthResponse, err := h.client.CheckHealth(ctx, &backend.CheckHealthRequest{
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

func (h *coreHTTPHandler) query(ctx context.Context, pluginCtx backend.PluginContext, responder rest.Responder) (http.Handler, error) {
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

		rsp, err := h.client.QueryData(ctx, &backend.QueryDataRequest{
			Queries:       queries,
			PluginContext: pluginCtx,
		})
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(query.GetResponseCode(rsp),
			&query.QueryDataResponse{QueryDataResponse: *rsp},
		)
	}), nil
}

func (h *coreHTTPHandler) resource(ctx context.Context, pluginCtx backend.PluginContext, responder rest.Responder) (http.Handler, error) {
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

		err = h.client.CallResource(ctx, &backend.CallResourceRequest{
			PluginContext: pluginCtx,
			Path:          clonedReq.URL.Path,
			Method:        req.Method,
			URL:           clonedReq.URL.String(),
			Body:          body,
			Headers:       req.Header,
		}, httpresponsesender.New(w))

		if err != nil {
			responder.Error(err)
		}
	}), nil
}

func resourceRequest(req *http.Request) (*http.Request, error) {
	idx := strings.LastIndex(req.URL.Path, "/resource")
	if idx < 0 {
		return nil, fmt.Errorf("expected resource path") // 400?
	}

	clonedReq := req.Clone(req.Context())
	rawURL := strings.TrimLeft(req.URL.Path[idx+len("/resource"):], "/")

	clonedReq.URL = &url.URL{
		Path:     rawURL,
		RawQuery: clonedReq.URL.RawQuery,
	}

	return clonedReq, nil
}
