package secret

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	secret "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	secretstore "github.com/grafana/grafana/pkg/storage/secret"
)

type secretHistory struct {
	store secretstore.SecureValueStore
}

var (
	_ rest.Connecter       = (*secretHistory)(nil)
	_ rest.StorageMetadata = (*secretHistory)(nil)
)

func (r *secretHistory) New() runtime.Object {
	return &secret.SecureValueActivityList{}
}

func (r *secretHistory) Destroy() {
}

func (r *secretHistory) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *secretHistory) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *secretHistory) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

func (r *secretHistory) ProducesObject(verb string) interface{} {
	return &secret.SecureValueActivityList{}
}

func (r *secretHistory) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns := request.NamespaceValue(ctx)
	val, err := r.store.History(ctx, ns, name, "")
	if err != nil {
		return nil, err
	}
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		responder.Object(http.StatusOK, val)
	}), nil
}
