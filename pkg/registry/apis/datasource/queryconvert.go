package datasource

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	dsV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
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

func (r *queryConvertREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	// The apiserver's collection-route rewriter supplies this synthetic name.
	if name != "name" {
		return nil, errors.NewNotFound(schema.GroupResource{}, name)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		result, err := convertQueryDataRequest(ctx, req, r.client, r.contextProvider)
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusOK, result)
	}), nil
}
