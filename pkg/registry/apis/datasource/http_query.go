package datasource

import (
	"context"
	"errors"
	"fmt"
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
		attribute.String("plugin_id", h.PluginID),
		attribute.String("datasource_uid", name),
	)
	defer connectSpan.End()

	m := newConnectMetric("query", h.PluginID)

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

		reqCtx, reqSpan := tracing.Start(ctx, "datasource.query.request",
			attribute.String("namespace", namespace),
			attribute.String("plugin_id", h.PluginID),
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
			responder.Error(err)
			return
		}

		_, convertSpan := tracing.Start(reqCtx, "datasource.query.convertQueries")
		queries, dsRef, err := data.ToDataSourceQueries(dqr)
		convertSpan.End()
		if err != nil {
			_ = tracing.Error(reqSpan, err)
			m.SetError()
			responder.Error(err)
			return
		}
		if dsRef != nil && dsRef.UID != name {
			err := fmt.Errorf("expected query body datasource and request to match")
			_ = tracing.Error(reqSpan, err)
			m.SetError()
			responder.Error(err)
			return
		}

		callCtx := config.WithGrafanaConfig(reqCtx, pluginCtx.GrafanaConfig)
		callCtx = contextualMiddlewares(callCtx)

		if chunked.IsRequestingChunkedResponse(req.Header.Get("accept")) {
			if !h.EnableChunkedQueries {
				responder.Error(fmt.Errorf("chunked query streaming is not enabled"))
				return
			}

			if err = h.Client.QueryChunkedData(callCtx, &backend.QueryChunkedDataRequest{
				Queries:       queries,
				PluginContext: pluginCtx,
				Headers:       map[string]string{},
				Format:        backend.DataFrameFormat_JSON, // encode directly in the plugin
			}, chunked.NewChunkedHTTPWriter(w)); err != nil {
				responder.Error(fmt.Errorf("error running chunked query %w", err))
			}
			return
		}

		queryCtx, querySpan := tracing.Start(callCtx, "datasource.query.pluginClient.QueryData",
			attribute.Int("queries_count", len(queries)),
		)

		rsp, err := h.Client.QueryData(queryCtx, &backend.QueryDataRequest{
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
