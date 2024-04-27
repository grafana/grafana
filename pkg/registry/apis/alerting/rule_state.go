package alerting

import (
	"context"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

type ruleStateREST struct{}

var _ = rest.Connecter(&ruleStateREST{})

func (r *ruleStateREST) New() runtime.Object {
	return &v0alpha1.AlertState{}
}

func (r *ruleStateREST) Destroy() {
}

func (r *ruleStateREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *ruleStateREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *ruleStateREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// TODO... actually get the status
		s := &v0alpha1.AlertState{}
		s.Dummy = "hello! " + info.Value + " // " + user.Email

		responder.Object(http.StatusOK, s)
	}), nil
}
