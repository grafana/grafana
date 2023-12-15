package example

import (
	"context"
	"fmt"
	"net/http"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/infra/appcontext"
)

type helloREST struct {
	txt string
}

var _ = rest.Connecter(&helloREST{})

func (r *helloREST) New() runtime.Object {
	return &metav1.Status{}
}

func (r *helloREST) Destroy() {
}

func (r *helloREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *helloREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *helloREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {

		if true {
			responder.Error(fmt.Errorf("dooh"))
			return
		}

		_, _ = w.Write([]byte(fmt.Sprintf("HELLO [%s]: %s", r.txt, user.Login)))
	}), nil
}
