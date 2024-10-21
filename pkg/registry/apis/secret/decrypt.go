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

type secretDecrypt struct {
	store secretstore.SecureValueStore
}

var (
	_ rest.Connecter       = (*secretDecrypt)(nil)
	_ rest.StorageMetadata = (*secretDecrypt)(nil)
)

func (r *secretDecrypt) New() runtime.Object {
	return &secret.SecureValue{}
}

func (r *secretDecrypt) Destroy() {
}

func (r *secretDecrypt) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *secretDecrypt) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *secretDecrypt) ProducesMIMETypes(verb string) []string {
	return []string{"text/plain"}
}

func (r *secretDecrypt) ProducesObject(verb string) interface{} {
	return &secret.SecureValue{}
}

func (r *secretDecrypt) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	ns := request.NamespaceValue(ctx)
	val, err := r.store.Decrypt(ctx, ns, name)
	if err != nil {
		return nil, err
	}
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if true {
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(val.Spec.Value)) // the raw value...
			return
		}

		responder.Object(http.StatusOK, val)
	}), nil
}
