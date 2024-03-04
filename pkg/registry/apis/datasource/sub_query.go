package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/middleware/requestmeta"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/web"
)

type subQueryREST struct {
	builder *DataSourceAPIBuilder
}

var _ = rest.Connecter(&subQueryREST{})

func (r *subQueryREST) New() runtime.Object {
	return &query.QueryDataResponse{}
}

func (r *subQueryREST) Destroy() {}

func (r *subQueryREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *subQueryREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subQueryREST) readQueries(req *http.Request) ([]backend.DataQuery, *query.DataSourceRef, error) {
	reqDTO := query.GenericQueryRequest{}
	if err := web.Bind(req, &reqDTO); err != nil {
		return nil, nil, err
	}
	return legacydata.ToDataSourceQueries(reqDTO)
}

func (r *subQueryREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	pluginCtx, err := r.builder.getPluginContext(ctx, name)
	if err != nil {
		return nil, err
	}
	ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		queries, dsRef, err := r.readQueries(req)
		if err != nil {
			responder.Error(err)
			return
		}
		if dsRef != nil && dsRef.UID != name {
			responder.Error(fmt.Errorf("expected the datasource in the request url and body to match"))
			return
		}

		qdr, err := r.builder.client.QueryData(ctx, &backend.QueryDataRequest{
			PluginContext: pluginCtx,
			Queries:       queries,
		})
		if err != nil {
			responder.Error(err)
			return
		}

		statusCode := http.StatusOK
		for _, res := range qdr.Responses {
			if res.Error != nil {
				statusCode = http.StatusMultiStatus
			}
		}
		if statusCode != http.StatusOK {
			requestmeta.WithDownstreamStatusSource(ctx)
		}

		// TODO... someday :) can return protobuf for machine-machine communication
		// will avoid some hops the current response workflow (for external plugins)
		// 1. Plugin:
		//     creates: golang structs
		//     returns: arrow + protobuf   |
		// 2. Client:                      | direct when local/non grpc
		//     reads: protobuf+arrow       V
		//     returns: golang structs
		// 3. Datasource Server (eg right here):
		//     reads: golang structs
		//     returns: JSON
		// 4. Query service (alerting etc):
		//     reads: JSON?  (TODO! raw output from 1???)
		//     returns: JSON (after more operations)
		// 5. Browser
		//     reads: JSON
		w.WriteHeader(statusCode)
		w.Header().Set("Content-Type", "application/json")
		err = json.NewEncoder(w).Encode(qdr)
		if err != nil {
			responder.Error(err)
		}
	}), nil
}
