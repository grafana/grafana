package datasource

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/config"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	dsV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/web"
	"go.opentelemetry.io/otel/attribute"
)

type subQueryREST struct {
	builder *DataSourceAPIBuilder
}

var (
	_ rest.Storage         = (*subQueryREST)(nil)
	_ rest.Connecter       = (*subQueryREST)(nil)
	_ rest.StorageMetadata = (*subQueryREST)(nil)
	_ rest.Scoper          = (*subQueryREST)(nil)
)

func (r *subQueryREST) New() runtime.Object {
	// This is added as the "ResponseType" regarless what ProducesObject() says :)
	return &dsV0.QueryDataResponse{}
}

func (r *subQueryREST) Destroy() {}

func (r *subQueryREST) NamespaceScoped() bool {
	return true
}

func (r *subQueryREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (r *subQueryREST) ProducesObject(verb string) interface{} {
	return &dsV0.QueryDataResponse{}
}

func (r *subQueryREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *subQueryREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subQueryREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	ctx, connectSpan := tracing.Start(ctx, "datasource.query.connect",
		attribute.String("plugin_id", r.builder.pluginJSON.ID),
		attribute.String("datasource_uid", name),
	)
	defer connectSpan.End()

	m := newConnectMetric("query", r.builder.pluginJSON.ID)

	pluginCtx, err := r.builder.getPluginContext(ctx, name)
	if err != nil {
		err = tracing.Error(connectSpan, err)
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			m.SetNotFound()
			m.Record()
			return nil, r.builder.datasourceResourceInfo.NewNotFound(name)
		}
		m.SetError()
		m.Record()
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		defer m.Record()

		reqCtx, reqSpan := tracing.Start(ctx, "datasource.query.request",
			attribute.String("plugin_id", r.builder.pluginJSON.ID),
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

		queryCtx, querySpan := tracing.Start(callCtx, "datasource.query.pluginClient.QueryData",
			attribute.Int("queries_count", len(queries)),
		)
		rsp, err := r.builder.client.QueryData(queryCtx, &backend.QueryDataRequest{
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
