package dataset

import (
	"context"
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	dataset "github.com/grafana/grafana/pkg/apis/dataset/v0alpha1"
)

type framesConnector struct {
	getter rest.Getter
}

var _ = rest.Connecter(&framesConnector{})

func (r *framesConnector) New() runtime.Object {
	return &dataset.Dataset{}
}

func (r *framesConnector) Destroy() {
}

func (r *framesConnector) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *framesConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *framesConnector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	obj, err := r.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	t, ok := obj.(*dataset.Dataset)
	if !ok {
		return nil, fmt.Errorf("expected dataset")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		responder.Object(http.StatusOK, t)
	}), nil
}
