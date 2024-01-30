package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
	"github.com/grafana/grafana/pkg/web"
)

type subQueryREST struct {
	builder *DataSourceAPIBuilder
}

var _ = rest.Connecter(&subQueryREST{})

func (r *subQueryREST) New() runtime.Object {
	return &v0alpha1.QueryDataResponse{}
}

func (r *subQueryREST) Destroy() {}

func (r *subQueryREST) ConnectMethods() []string {
	return []string{"POST", "GET"}
}

func (r *subQueryREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subQueryREST) readQueries(req *http.Request) ([]backend.DataQuery, *v0alpha1.DataSourceRef, error) {
	// Simple URL to JSON mapping
	if req.Method == http.MethodGet {
		body := make(map[string]any, 0)
		for k, v := range req.URL.Query() {
			switch len(v) {
			case 0:
				body[k] = true
			case 1:
				body[k] = v[0] // TODO, convert numbers
			default:
				body[k] = v // TODO, convert numbers
			}
		}

		var err error
		dq := backend.DataQuery{
			RefID: "A",
			TimeRange: backend.TimeRange{
				From: time.Now().Add(-1 * time.Hour), // last hour
				To:   time.Now(),
			},
			MaxDataPoints: 1000,
			Interval:      time.Second * 10,
		}
		dq.JSON, err = json.Marshal(body)
		return []backend.DataQuery{dq}, nil, err
	}

	reqDTO := v0alpha1.GenericQueryRequest{}
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

		queryResponse, err := r.builder.client.QueryData(ctx, &backend.QueryDataRequest{
			PluginContext: pluginCtx,
			Queries:       queries,
			//  Headers: // from context
		})
		if err != nil {
			responder.Error(err)
			return
		}

		// TODO: get format (maybe protobuf!!!)
		jsonRsp, err := json.Marshal(queryResponse)
		if err != nil {
			responder.Error(err)
			return
		}
		w.WriteHeader(200)
		_, _ = w.Write(jsonRsp)
	}), nil
}
