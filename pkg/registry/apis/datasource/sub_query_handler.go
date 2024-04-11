package datasource

import (
	"context"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"k8s.io/apiserver/pkg/registry/rest"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/web"
)

type CorePluginQueryHandler struct {
	client PluginClient
}

func NewCorePluginQueryHandler(client PluginClient) *CorePluginQueryHandler {
	return &CorePluginQueryHandler{
		client: client,
	}
}

func (r *CorePluginQueryHandler) Handle(ctx context.Context, pluginCtx backend.PluginContext, responder rest.Responder) (http.Handler, error) {
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
		if dsRef != nil && dsRef.UID != pluginCtx.DataSourceInstanceSettings.UID { // same as name?
			responder.Error(fmt.Errorf("expected query body datasource and request to match"))
			return
		}

		ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
		ctx = contextualMiddlewares(ctx)
		rsp, err := r.client.QueryData(ctx, &backend.QueryDataRequest{
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

type ExternalPluginQueryHandler struct {
	client PluginProtoClient
}

func NewExternalPluginQueryHandler(client PluginProtoClient) *ExternalPluginQueryHandler {
	return &ExternalPluginQueryHandler{
		client: client,
	}
}

func (r *ExternalPluginQueryHandler) Handle(ctx context.Context, pluginCtx backend.PluginContext, responder rest.Responder) (http.Handler, error) {
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
		if dsRef != nil && dsRef.UID != pluginCtx.DataSourceInstanceSettings.UID { // same as name?
			responder.Error(fmt.Errorf("expected query body datasource and request to match"))
			return
		}

		var qs []*pluginv2.DataQuery
		for _, dq := range queries {
			qs = append(qs, backend.ToProto().DataQuery(dq))
		}

		ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
		ctx = contextualMiddlewares(ctx)
		rsp, err := r.client.QueryData(ctx, &pluginv2.QueryDataRequest{
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
