package folders

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

type subMoveREST struct {
	searcher resource.ResourceIndexClient
}

var (
	_ = rest.Connecter(&subCountREST{})
	_ = rest.StorageMetadata(&subCountREST{})
)

func (r *subMoveREST) New() runtime.Object {
	return &v0alpha1.Folder{}
}

func (r *subMoveREST) Destroy() {
}

func (r *subMoveREST) ConnectMethods() []string {
	return []string{"PATCH"}
}

func (r *subMoveREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *subMoveREST) ProducesObject(verb string) interface{} {
	return &v0alpha1.Folder{}
}

func (r *subMoveREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subMoveREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		_, err := request.NamespaceInfoFrom(ctx, true)
		if err != nil {
			responder.Error(err)
			return
		}
		rsp := &v0alpha1.Folder{}
		responder.Object(200, rsp)
	}), nil
}
