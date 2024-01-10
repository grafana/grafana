package datasource

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/tsdb/legacydata"
)

type subQueryREST struct {
	builder *DataSourceAPIBuilder
}

var _ = rest.Connecter(&subQueryREST{})

func (r *subQueryREST) New() runtime.Object {
	return &v0alpha1.QueryResults{}
}

func (r *subQueryREST) Destroy() {}

func (r *subQueryREST) ConnectMethods() []string {
	return []string{"POST", "GET"}
}

func (r *subQueryREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subQueryREST) readQueries(req *http.Request) ([]backend.DataQuery, error) {
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
		return []backend.DataQuery{dq}, err
	}

	body, err := io.ReadAll(req.Body)
	if err != nil {
		return nil, err
	}

	// Convert query request to backend query request
	// TODO... we should likely accept []Queries directly
	qr := v0alpha1.QueryRequest{}
	err = json.Unmarshal(body, &qr)
	if err != nil {
		return nil, err
	}
	tr := legacydata.NewDataTimeRange(qr.From, qr.To)
	backendTr := backend.TimeRange{
		From: tr.MustGetFrom(),
		To:   tr.MustGetTo(),
	}

	bdq := []backend.DataQuery{}
	for _, q := range qr.Queries {
		dq := backend.DataQuery{
			RefID:         q.RefID,
			QueryType:     q.QueryType,
			MaxDataPoints: q.MaxDataPoints,
			Interval:      time.Duration(q.IntervalMS),
			TimeRange:     backendTr,
		}
		dq.JSON, err = json.Marshal(q)
		if err != nil {
			return nil, err
		}
		bdq = append(bdq, dq)
	}
	return bdq, err
}

func (r *subQueryREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	pluginCtx, err := r.builder.getDataSourcePluginContext(ctx, name)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		queries, err := r.readQueries(req)
		if err != nil {
			responder.Error(err)
			return
		}

		queryResponse, err := r.builder.client.QueryData(ctx, &backend.QueryDataRequest{
			PluginContext: *pluginCtx,
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
