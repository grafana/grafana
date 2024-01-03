package featureflags

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apis/featureflags/v0alpha1"
	"github.com/grafana/grafana/pkg/services/grafana-apiserver/endpoints/request"
)

type togglesStatusREST struct{}

var _ = rest.Connecter(&togglesStatusREST{})

func (r *togglesStatusREST) New() runtime.Object {
	return &v0alpha1.ToggleStatus{}
}

func (r *togglesStatusREST) Destroy() {
}

func (r *togglesStatusREST) ConnectMethods() []string {
	return []string{"GET"}
}

func (r *togglesStatusREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, "" // true means you can use the trailing path as a variable
}

func (r *togglesStatusREST) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	info, err := request.NamespaceInfoFrom(ctx, false) // allow system
	if err != nil {
		return nil, err
	}
	if info.Value != "system" {
		return nil, fmt.Errorf("only system namespace is currently supported")
	}
	if name != "startup" {
		return nil, fmt.Errorf("only system/startup is currently supported")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		status := &v0alpha1.ToggleStatus{}
		status.Editable = []string{"a", "b", "c"}
		status.Hidden = []string{"x"}
		status.Toggles = []v0alpha1.ToggleState{
			{
				Feature: "aaaa",
				Enabled: true,
				Source:  "default",
			},
			{
				Feature: "bbbb",
				Enabled: true,
				Source:  "startup",
			},
		}
		responder.Object(http.StatusOK, status)
	}), nil
}
