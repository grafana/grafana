package datasource

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	data "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	dsV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/web"
)

type pluginClientConversion interface {
	backend.ConversionHandler
}

type queryConvertREST struct {
	client          pluginClientConversion
	contextProvider PluginContextWrapper
}

var (
	_ rest.Storage              = (*queryConvertREST)(nil)
	_ rest.Connecter            = (*queryConvertREST)(nil)
	_ rest.Scoper               = (*queryConvertREST)(nil)
	_ rest.SingularNameProvider = (*queryConvertREST)(nil)
)

func registerQueryConvert(client pluginClientConversion, contextProvider PluginContextWrapper, storage map[string]rest.Storage) {
	store := &queryConvertREST{
		client:          client,
		contextProvider: contextProvider,
	}
	storage["queryconvert"] = store
}

func (r *queryConvertREST) New() runtime.Object {
	return &dsV0.QueryDataRequest{}
}

func (r *queryConvertREST) Destroy() {}

func (r *queryConvertREST) NamespaceScoped() bool {
	return true
}

func (r *queryConvertREST) GetSingularName() string {
	return "queryconvert"
}

func (r *queryConvertREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *queryConvertREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *queryConvertREST) convertQueryDataRequest(ctx context.Context, req *http.Request) (*dsV0.QueryDataRequest, error) {
	dqr := data.QueryDataRequest{}
	err := web.Bind(req, &dqr)
	if err != nil {
		return nil, err
	}

	ds := dqr.Queries[0].Datasource
	pluginCtx, err := r.contextProvider.PluginContextForDataSource(ctx, &backend.DataSourceInstanceSettings{
		Type:       ds.Type,
		UID:        ds.UID,
		APIVersion: ds.APIVersion,
	})
	if err != nil {
		return nil, err
	}

	ctx = backend.WithGrafanaConfig(ctx, pluginCtx.GrafanaConfig)
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

	convertResponse, err := r.client.ConvertObjects(ctx, convertRequest)
	if err != nil {
		if convertResponse != nil && convertResponse.Result != nil {
			return nil, fmt.Errorf("conversion failed. Err: %w. Result: %s", err, convertResponse.Result.Message)
		}
		return nil, err
	}

	qr := &dsV0.QueryDataRequest{}
	for _, obj := range convertResponse.Objects {
		if obj.ContentType != "application/json" {
			return nil, fmt.Errorf("unexpected content type: %s", obj.ContentType)
		}
		q := &data.DataQuery{}
		err = json.Unmarshal(obj.Raw, q)
		if err != nil {
			return nil, fmt.Errorf("unmarshal: %w", err)
		}
		qr.Queries = append(qr.Queries, *q)
	}

	return qr, nil
}

func (r *queryConvertREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	// See: /pkg/services/apiserver/builder/helper.go#L34
	// The name is set with a rewriter hack
	if name != "name" {
		return nil, errors.NewNotFound(schema.GroupResource{}, name)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		r, err := r.convertQueryDataRequest(ctx, req)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusOK, r)
	}), nil
}
