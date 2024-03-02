package datasource

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
)

type subQueryREST struct {
	builder *DataSourceAPIBuilder
}

var (
	_ rest.Storage         = (*subQueryREST)(nil)
	_ rest.Creater         = (*subQueryREST)(nil)
	_ rest.StorageMetadata = (*subQueryREST)(nil)
)

func (r *subQueryREST) New() runtime.Object {
	return &query.QueryDataRequest{}
}

func (r *subQueryREST) Destroy() {}

func (r *subQueryREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (r *subQueryREST) ProducesObject(verb string) interface{} {
	return &query.QueryDataResponse{}
}

// handles the POST method
func (r *subQueryREST) Create(ctx context.Context, obj runtime.Object, validator rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	info, ok := request.RequestInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing request info")
	}

	req, ok := obj.(*query.QueryDataRequest)
	if !ok {
		return nil, fmt.Errorf("error reading request")
	}

	pluginCtx, err := r.builder.getPluginContext(ctx, info.Name)
	if err != nil {
		return nil, err
	}
	ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)

	fmt.Printf("TODO: %v // %v\n", req, ctx)

	res := &v0alpha1.QueryDataResponse{
		QueryDataResponse: backend.QueryDataResponse{},
	}
	return res, nil
}

// func (r *subQueryREST) readQueries(req *http.Request) ([]backend.DataQuery, *query.DataSourceRef, error) {
// 	reqDTO := query.GenericQueryRequest{}
// 	if err := web.Bind(req, &reqDTO); err != nil {
// 		return nil, nil, err
// 	}
// 	return legacydata.ToDataSourceQueries(reqDTO)
// // }

// func (r *subQueryREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
// 	pluginCtx, err := r.builder.getPluginContext(ctx, name)
// 	if err != nil {
// 		return nil, err
// 	}
// 	ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)

// 	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
// 		queries, dsRef, err := r.readQueries(req)
// 		if err != nil {
// 			responder.Error(err)
// 			return
// 		}
// 		if dsRef != nil && dsRef.UID != name {
// 			responder.Error(fmt.Errorf("expected the datasource in the request url and body to match"))
// 			return
// 		}

// 		qdr, err := r.builder.client.QueryData(ctx, &backend.QueryDataRequest{
// 			PluginContext: pluginCtx,
// 			Queries:       queries,
// 		})
// 		if err != nil {
// 			responder.Error(err)
// 			return
// 		}

// 		statusCode := http.StatusOK
// 		for _, res := range qdr.Responses {
// 			if res.Error != nil {
// 				statusCode = http.StatusMultiStatus
// 			}
// 		}
// 		if statusCode != http.StatusOK {
// 			requestmeta.WithDownstreamStatusSource(ctx)
// 		}

// 		// TODO... someday :) can return protobuf for machine-machine communication
// 		// will avoid some hops the current response workflow (for external plugins)
// 		// 1. Plugin:
// 		//     creates: golang structs
// 		//     returns: arrow + protobuf   |
// 		// 2. Client:                      | direct when local/non grpc
// 		//     reads: protobuf+arrow       V
// 		//     returns: golang structs
// 		// 3. Datasource Server (eg right here):
// 		//     reads: golang structs
// 		//     returns: JSON
// 		// 4. Query service (alerting etc):
// 		//     reads: JSON?  (TODO! raw output from 1???)
// 		//     returns: JSON (after more operations)
// 		// 5. Browser
// 		//     reads: JSON
// 		w.WriteHeader(statusCode)
// 		w.Header().Set("Content-Type", "application/json")
// 		err = json.NewEncoder(w).Encode(qdr)
// 		if err != nil {
// 			responder.Error(err)
// 		}
// 	}), nil
// }
