package ofrep

import (
	"context"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

// This is a dummy connector that is not actually used for anything
// EXCEPT -- k8s requires *something* to be registered so it will add the storage to discovery.
// As a quick workaround, we register a noop storage; and then manually remove it from openapi
type NoopConnector struct{}

var (
	_ rest.Connecter            = (*NoopConnector)(nil)
	_ rest.StorageMetadata      = (*NoopConnector)(nil)
	_ rest.Scoper               = (*NoopConnector)(nil)
	_ rest.SingularNameProvider = (*NoopConnector)(nil)
)

func (r *NoopConnector) New() runtime.Object {
	return &metav1.Status{}
}

func (r *NoopConnector) NamespaceScoped() bool {
	return true // namespaced
}

func (r *NoopConnector) GetSingularName() string {
	return "noop"
}

func (r *NoopConnector) Destroy() {
}

func (r *NoopConnector) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *NoopConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

func (r *NoopConnector) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *NoopConnector) ProducesObject(verb string) interface{} {
	return r.New()
}

func (r *NoopConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		_, _ = w.Write([]byte("NOOP"))
	}), nil
}
