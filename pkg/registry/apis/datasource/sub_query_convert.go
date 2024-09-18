package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/data/v0alpha1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	query "github.com/grafana/grafana/pkg/apis/query/v0alpha1"
	"github.com/grafana/grafana/pkg/web"
)

type subQueryConvertREST struct {
	builder *DataSourceAPIBuilder
}

var (
	_ rest.Storage         = (*subQueryREST)(nil)
	_ rest.Connecter       = (*subQueryREST)(nil)
	_ rest.StorageMetadata = (*subQueryREST)(nil)
)

func (r *subQueryConvertREST) New() runtime.Object {
	// This is added as the "ResponseType" regarless what ProducesObject() says :)
	return &query.QueryDataRequest{}
}

func (r *subQueryConvertREST) Destroy() {}

func (r *subQueryConvertREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (r *subQueryConvertREST) ProducesObject(verb string) interface{} {
	return &query.QueryDataRequest{}
}

func (r *subQueryConvertREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *subQueryConvertREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

type pluginCtxFunc func(context.Context, string) (backend.PluginContext, error)

func ConvertQueryDataRequest(ctx context.Context, req *http.Request, pluginCtxFn pluginCtxFunc, convertFn backend.ConvertObjectsFunc) (*query.QueryDataRequest, error) {
	dqr := data.QueryDataRequest{}
	err := web.Bind(req, &dqr)
	if err != nil {
		return nil, err
	}

	_, _, err = data.ToDataSourceQueries(dqr)
	if err != nil {
		return nil, err
	}

	if len(dqr.Queries) == 0 {
		return nil, fmt.Errorf("no queries")
	}

	pluginCtx, err := pluginCtxFn(ctx, dqr.Queries[0].Datasource.UID)
	if err != nil {
		return nil, err
	}

	ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
	ctx = contextualMiddlewares(ctx)
	raw, err := json.Marshal(dqr)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}
	convertRequest := &backend.ConversionRequest{
		PluginContext: pluginCtx,
		Objects: []backend.RawObject{
			{
				Raw:         raw,
				ContentType: "application/json",
			},
		},
	}

	convertResponse, err := convertFn(ctx, convertRequest)
	if err != nil {
		if convertResponse != nil && convertResponse.Result != nil {
			return nil, fmt.Errorf("conversion failed. Err: %w. Result: %s", err, convertResponse.Result.Message)
		}
		return nil, err
	}

	r := &query.QueryDataRequest{}
	for _, obj := range convertResponse.Objects {
		if obj.ContentType != "application/json" {
			return nil, fmt.Errorf("unexpected content type: %s", obj.ContentType)
		}
		q := &data.DataQuery{}
		err = json.Unmarshal(obj.Raw, q)
		if err != nil {
			return nil, fmt.Errorf("unmarshal: %w", err)
		}
		r.Queries = append(r.Queries, *q)
	}

	return r, nil
}

func (r *subQueryConvertREST) Connect(ctx context.Context, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		r, err := ConvertQueryDataRequest(ctx, req, r.builder.getPluginContext, r.builder.client.ConvertObjects)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusOK, r)
	}), nil
}
