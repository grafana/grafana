package peakq

import (
	"context"
	"net/http"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	common "github.com/grafana/grafana/pkg/apis/common/v0alpha1"
	peakq "github.com/grafana/grafana/pkg/apis/peakq/v0alpha1"
)

type renderREST struct {
	// storage *genericregistry.Store
}

var _ = rest.Connecter(&renderREST{})

func (r *renderREST) New() runtime.Object {
	return &peakq.RenderedQuery{}
}

func (r *renderREST) Destroy() {
}

func (r *renderREST) ConnectMethods() []string {
	return []string{"POST"}
}

func (r *renderREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *renderREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	// TODO!!!
	// get the value from the store
	template := &peakq.QueryTemplate{
		ObjectMeta: v1.ObjectMeta{
			Name: name,
		},
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		out := &peakq.RenderedQuery{
			Targets: []common.Unstructured{
				{Object: map[string]any{
					"hello":  "world",
					"TODO":   "read the value and render it",
					"RENDER": template.Name,
				}},
			},
		}
		responder.Object(http.StatusOK, out)
	}), nil
}
