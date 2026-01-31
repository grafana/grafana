package datasource

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	datasourceV0alpha1 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type subAccessREST struct {
	builder *DataSourceAPIBuilder
	getter  rest.Getter
}

var _ = rest.Connecter(&subAccessREST{})
var _ = rest.StorageMetadata(&subAccessREST{})

func (r *subAccessREST) New() runtime.Object {
	return &datasourceV0alpha1.DatasourceAccessInfo{}
}

func (r *subAccessREST) Destroy() {
	// I don't know what this is for.
}

func (r *subAccessREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subAccessREST) ProducesMIMETypes(verb string) []string {
	// I don't know what this is for.
	return nil
}

func (r *subAccessREST) ProducesObject(verb string) interface{} {
	// I don't know what this is for.
	return nil
}

func (r *subAccessREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subAccessREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		access, err := r.getAccessInfo(ctx, name)
		if err != nil {
			responder.Error(err)
		} else {
			responder.Object(200, access)
		}
	}), nil
}

func (r *subAccessREST) getAccessInfo(ctx context.Context, name string) (*datasourceV0alpha1.DatasourceAccessInfo, error) {
	reqContext := contexthandler.FromContext(ctx)
	resourceIDs := map[string]bool{datasources.ScopePrefix: true}
	access := accesscontrol.GetResourcesMetadata(reqContext.Req.Context(), reqContext.GetPermissions(), datasources.ScopePrefix, resourceIDs)
	return &datasourceV0alpha1.DatasourceAccessInfo{
		Permissions: access[datasources.ScopePrefix],
	}, nil
}
