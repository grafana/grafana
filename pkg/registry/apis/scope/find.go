package scope

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	scope "github.com/grafana/grafana/pkg/apis/scope/v0alpha1"
)

type subQueryREST struct {
}

var (
	_ rest.Storage              = (*subQueryREST)(nil)
	_ rest.SingularNameProvider = (*subQueryREST)(nil)
	_ rest.Connecter            = (*subQueryREST)(nil)
	_ rest.Scoper               = (*subQueryREST)(nil)
	_ rest.StorageMetadata      = (*subQueryREST)(nil)
)

func (r *subQueryREST) New() runtime.Object {
	// This is added as the "ResponseType" regarless what ProducesObject() says :)
	return &scope.FindResults{}
}

func (r *subQueryREST) Destroy() {}

func (s *subQueryREST) NamespaceScoped() bool {
	return true
}

func (s *subQueryREST) GetSingularName() string {
	return "results" // not sure if this is actually used, but it is required to exist
}

func (r *subQueryREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"} // and parquet!
}

func (r *subQueryREST) ProducesObject(verb string) interface{} {
	return &scope.FindResults{}
}

func (r *subQueryREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *subQueryREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *subQueryREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		responder.Object(200,
			&scope.FindResults{
				Message: "hello",
				Found:   []string{"A", "B", "C"},
			},
		)
	}), nil
}
