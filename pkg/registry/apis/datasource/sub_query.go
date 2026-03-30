package datasource

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	dsV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/web"
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
	start := time.Now()
	pluginID := r.builder.pluginJSON.ID

	pluginCtx, err := r.builder.getPluginContext(ctx, name)
	if err != nil {
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			dsSubresourceRequests.WithLabelValues("query", pluginID, "not_found").Inc()
			return nil, r.builder.datasourceResourceInfo.NewNotFound(name)
		}
		dsSubresourceRequests.WithLabelValues("query", pluginID, "error").Inc()
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		dqr := data.QueryDataRequest{}
		err := web.Bind(req, &dqr)
		if err != nil {
			dsSubresourceRequests.WithLabelValues("query", pluginID, "error").Inc()
			responder.Error(err)
			return
		}

		queries, dsRef, err := data.ToDataSourceQueries(dqr)
		if err != nil {
			dsSubresourceRequests.WithLabelValues("query", pluginID, "error").Inc()
			responder.Error(err)
			return
		}
		if dsRef != nil && dsRef.UID != name {
			dsSubresourceRequests.WithLabelValues("query", pluginID, "error").Inc()
			responder.Error(fmt.Errorf("expected query body datasource and request to match"))
			return
		}

		ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
		ctx = contextualMiddlewares(ctx)

		rsp, err := r.builder.client.QueryData(ctx, &backend.QueryDataRequest{
			Queries:       queries,
			PluginContext: pluginCtx,
			Headers:       map[string]string{},
		})

		var e errutil.Error
		if errors.As(err, &e) && e.Source == errutil.SourceDownstream {
			dsSubresourceRequests.WithLabelValues("query", pluginID, "error").Inc()
			dsSubresourceRequestDuration.WithLabelValues("query", pluginID).Observe(time.Since(start).Seconds())
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
			dsSubresourceRequests.WithLabelValues("query", pluginID, "error").Inc()
			responder.Error(err)
			return
		}

		dsSubresourceRequests.WithLabelValues("query", pluginID, "success").Inc()
		dsSubresourceRequestDuration.WithLabelValues("query", pluginID).Observe(time.Since(start).Seconds())
		responder.Object(dsV0.GetResponseCode(rsp),
			&dsV0.QueryDataResponse{QueryDataResponse: *rsp},
		)
	}), nil
}
