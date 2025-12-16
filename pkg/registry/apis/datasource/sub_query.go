package datasource

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"google.golang.org/protobuf/proto"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
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
	return &query.QueryDataResponse{}
}

func (r *subQueryREST) Destroy() {}

func (r *subQueryREST) NamespaceScoped() bool {
	return true
}

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
		if errors.Is(err, datasources.ErrDataSourceNotFound) {
			return nil, r.builder.datasourceResourceInfo.NewNotFound(name)
		}
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

		rsp, err := r.builder.client.QueryData(ctx, &backend.QueryDataRequest{
			Queries:       queries,
			PluginContext: pluginCtx,
			Headers:       map[string]string{},
		})

		code := query.GetResponseCode(rsp)

		// all errors get converted into k8 errors when sent in responder.Error and lose important context like downstream info
		var e errutil.Error
		if errors.As(err, &e) && e.Source == errutil.SourceDownstream {
			err = nil
			rsp = &backend.QueryDataResponse{Responses: map[string]backend.DataResponse{
				"A": {
					Error:       errors.New(e.LogMessage),
					ErrorSource: backend.ErrorSourceDownstream,
					Status:      backend.StatusBadRequest,
				},
			}}
		}
		if err != nil {
			responder.Error(err)
			return
		}

		// Respond with raw protobuf when requested
		for _, accept := range req.Header.Values("Accept") {
			if accept == query.PROTOBUF_CONTENT_TYPE { // pluginv2.QueryDataResponse
				p, err := backend.ToProto().QueryDataResponse(rsp)
				if err != nil {
					responder.Error(err)
					return
				}
				data, err := proto.Marshal(p)
				if err != nil {
					responder.Error(err)
					return
				}
				w.Header().Add("Content-Type", query.PROTOBUF_CONTENT_TYPE)
				w.WriteHeader(code)
				_, err = w.Write(data)
				if err != nil {
					logging.FromContext(ctx).Warn("unable to write protobuf result", "err", err)
				}
				return
			}
		}

		responder.Object(code,
			&query.QueryDataResponse{QueryDataResponse: *rsp},
		)
	}), nil
}
