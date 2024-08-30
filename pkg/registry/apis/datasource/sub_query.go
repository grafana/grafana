package datasource

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/web"
)

type subQueryREST struct {
	builder *DataSourceAPIBuilder
}

var (
	_ rest.Storage         = (*subQueryREST)(nil)
	_ rest.Connecter       = (*subQueryREST)(nil)
	_ rest.StorageMetadata = (*subQueryREST)(nil)
)

func (r *subQueryREST) New() runtime.Object {
	// This is added as the "ResponseType" regarless what ProducesObject() says :)
	return &query.QueryDataResponse{}
}

func (r *subQueryREST) Destroy() {}

func (r *subQueryREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (r *subQueryREST) ProducesObject(verb string) interface{} {
	return &query.QueryDataResponse{}
}

func (r *subQueryREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *subQueryREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subQueryREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	pluginCtx, err := r.builder.getPluginContext(ctx, name)
	if err != nil {
		return nil, err
	}
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		dqr := data.QueryDataRequest{}
		err := web.Bind(req, &dqr)
		if err != nil {
			responder.Error(err)
			return
		}

		queries, dsRef, err := data.ToDataSourceQueries(dqr)
		if err != nil {
			responder.Error(err)
			return
		}
		if dsRef != nil && dsRef.UID != name {
			responder.Error(fmt.Errorf("expected query body datasource and request to match"))
			return
		}

		ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
		ctx = contextualMiddlewares(ctx)

		// only forward expected headers, log unexpected ones
		headers := make(map[string]string)
		// headers are case insensitive, however some datasources still check for camel casing so we have to send them camel cased
		expectedHeaders := map[string]string{
			"fromalert":      "FromAlert",
			"content-type":   "Content-Type",
			"content-length": "Content-Length",
			"user-agent":     "User-Agent",
			"accept":         "Accept",
		}
		for k, v := range req.Header {
			headerToSend, ok := expectedHeaders[strings.ToLower(k)]
			if ok {
				headers[headerToSend] = v[0]
			} else {
				r.builder.log.Warn("datasource received an unexpected header, ignoring it", "header", k)
			}
		}

		rsp, err := r.builder.client.QueryData(ctx, &backend.QueryDataRequest{
			Queries:       queries,
			PluginContext: pluginCtx,
			Headers:       headers,
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
