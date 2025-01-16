package reststorage

import (
	"context"
	"net/http"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

var (
	_ rest.Storage         = (*SecureValueDecryptRest)(nil)
	_ rest.Scoper          = (*SecureValueDecryptRest)(nil)
	_ rest.Connecter       = (*SecureValueDecryptRest)(nil)
	_ rest.StorageMetadata = (*SecureValueDecryptRest)(nil)
)

type SecureValueDecryptRest struct {
	resource utils.ResourceInfo
}

func NewSecureValueDecryptRest(resource utils.ResourceInfo) *SecureValueDecryptRest {
	return &SecureValueDecryptRest{
		resource: resource,
	}
}

func (s *SecureValueDecryptRest) New() runtime.Object {
	return s.resource.NewFunc()
}

func (s *SecureValueDecryptRest) Destroy() {}

func (s *SecureValueDecryptRest) NamespaceScoped() bool {
	return true
}

func (r *SecureValueDecryptRest) ProducesMIMETypes(verb string) []string {
	return []string{"text/plain"}
}

func (r *SecureValueDecryptRest) ProducesObject(verb string) interface{} {
	return r.resource.NewFunc()
}

func (r *SecureValueDecryptRest) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func (r *SecureValueDecryptRest) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *SecureValueDecryptRest) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		w.Write([]byte("secret"))
	}), nil
}
