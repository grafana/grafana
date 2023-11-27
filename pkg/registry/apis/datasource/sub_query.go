package datasource

import (
	"context"
	"encoding/json"
	"io"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type subQueryREST struct {
	builder *DSAPIBuilder
}

var _ = rest.Connecter(&subQueryREST{})

func (r *subQueryREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *subQueryREST) Destroy() {
}

func (r *subQueryREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *subQueryREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *subQueryREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	pluginCtx, err := r.builder.getDataSourcePluginContext(ctx, name)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		body, err := io.ReadAll(req.Body)
		if err != nil {
			responder.Error(err)
			return
		}
		queries, err := readQueries(body)
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
			return
		}

		jsonRsp, err := json.Marshal(queryResponse)
		if err != nil {
			responder.Error(err)
			return
		}
		w.WriteHeader(200)
		_, _ = w.Write(jsonRsp)
	}), nil
}
