package datasource

import (
	"context"
	"errors"
	"net/http"

	"go.opentelemetry.io/otel/attribute"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	dsV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/plugins/backendplugin/chunked"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/web"
)

func (h *HTTPHandlers) query(ctx context.Context, name string, responder httpResponder) (http.Handler, error) {
	namespace := request.NamespaceValue(ctx)
	ctx, connectSpan := tracing.Start(ctx, "datasource.query.connect",
		attribute.String("namespace", namespace),
		attribute.String("plugin_id", h.options.PluginID),
		attribute.String("datasource_uid", name),
	)
	defer connectSpan.End()

	m := newConnectMetric("query", h.options.PluginID)

	pluginCtx, err := h.options.PluginContext(ctx, name)
	if err != nil {
		err = tracing.Error(connectSpan, err)
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			m.SetNotFound()
			m.Record()
			return nil, apierrors.NewNotFound(schema.GroupResource{Group: h.options.Group, Resource: "datasources"}, name)
		}
		m.SetError()
		m.Record()
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		defer m.Record()
		if h.options.HandlerOrigin != "" {
			w.Header().Set("X-Grafana-DS-Apiserver", h.options.HandlerOrigin)
		}

		reqCtx, reqSpan := tracing.Start(ctx, "datasource.query.request",
			attribute.String("namespace", namespace),
			attribute.String("plugin_id", h.options.PluginID),
			attribute.String("datasource_uid", name),
		)
		defer reqSpan.End()

		dqr := data.QueryDataRequest{}
		_, bindSpan := tracing.Start(reqCtx, "datasource.query.bindRequest")
		err := web.Bind(req, &dqr)
		bindSpan.End()
		if err != nil {
			_ = tracing.Error(reqSpan, err)
			m.SetError()
			responder.Error(RequestError(err))
			return
		}

		_, convertSpan := tracing.Start(reqCtx, "datasource.query.convertQueries")
		queries, dsRef, err := data.ToDataSourceQueries(dqr)
		convertSpan.End()
		if err != nil {
			_ = tracing.Error(reqSpan, err)
			m.SetError()
			responder.Error(RequestError(err))
			return
		}
		if dsRef != nil && dsRef.UID != name {
			err := apierrors.NewBadRequest("expected query body datasource and request to match")
			_ = tracing.Error(reqSpan, err)
			m.SetError()
			responder.Error(err)
			return
		}

		callCtx := config.WithGrafanaConfig(reqCtx, pluginCtx.GrafanaConfig)
		callCtx = contextualMiddlewares(callCtx)

		if chunked.IsRequestingChunkedResponse(req.Header.Get("accept")) {
			if !h.options.EnableChunkedQueries {
				responder.Error(apierrors.NewGenericServerResponse(http.StatusNotAcceptable, "", schema.GroupResource{}, "", "chunked query streaming is not enabled", 0, false))
				return
			}

			if err = h.options.Client.QueryChunkedData(callCtx, &backend.QueryChunkedDataRequest{
				Queries:       queries,
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
				Format:        backend.DataFrameFormat_JSON, // encode directly in the plugin
			}, chunked.NewChunkedHTTPWriter(w)); err != nil {
				responder.Error(err)
			}
			return
		}

		queryCtx, querySpan := tracing.Start(callCtx, "datasource.query.pluginClient.QueryData",
			attribute.Int("queries_count", len(queries)),
		)

		rsp, err := h.options.Client.QueryData(queryCtx, &backend.QueryDataRequest{
			Queries:       queries,
			PluginContext: pluginCtx,
			Headers:       map[string]string{},
		})
		querySpan.End()

		// all errors get converted into k8s errors when sent in responder.Error and lose important context like downstream info
		var e errutil.Error
		if errors.As(err, &e) && e.Source == errutil.SourceDownstream {
			_ = tracing.Error(reqSpan, err)
			m.SetError()
			responder.Object(int(backend.StatusBadRequest),
				&dsV0.QueryDataResponse{QueryDataResponse: backend.QueryDataResponse{Responses: map[string]backend.DataResponse{
					"A": {
						Error:       errors.New(e.LogMessage),
						ErrorSource: backend.ErrorSourceDownstream,
						Status:      backend.StatusBadRequest,
					},
				}}},
			)
			return
		}

		if err != nil {
			_ = tracing.Error(reqSpan, err)
			m.SetError()
			responder.Error(err)
			return
		}

		responder.Object(dsV0.GetResponseCode(rsp),
			&dsV0.QueryDataResponse{QueryDataResponse: *rsp},
		)
	}), nil
}
