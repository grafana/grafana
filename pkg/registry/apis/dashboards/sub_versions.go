package dashboards

import (
	"context"
	"fmt"
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/api/response"
	dashboards "github.com/grafana/grafana/pkg/apis/dashboards/v0alpha1"
)

type VersionsREST struct {
	Store *genericregistry.Store
}

var _ = rest.Connecter(&VersionsREST{})

var methods = []string{"GET"}

func (r *VersionsREST) New() runtime.Object {
	return &dashboards.VersionsQueryOptions{}
}

func (r *VersionsREST) Destroy() {
}

func (r *VersionsREST) ConnectMethods() []string {
	return methods
}

func (r *VersionsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return &dashboards.VersionsQueryOptions{}, false, ""
}

func (r *VersionsREST) Connect(ctx context.Context, id string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	queryOpts, ok := opts.(*dashboards.VersionsQueryOptions)
	if !ok {
		return nil, fmt.Errorf("invalid options object: %#v", opts)
	}
	fmt.Println("VersionsREST.Connect() called with id:", id, "and opts:", queryOpts)
	return &fakeHandler{opts: queryOpts}, nil
}

type fakeHandler struct {
	opts *dashboards.VersionsQueryOptions
}

func (f *fakeHandler) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	rsp := map[string]any{
		"url":  req.URL.Path,
		"opts": f.opts,
	}

	w.WriteHeader(http.StatusOK)
	w.Write(response.JSON(http.StatusOK, rsp).Body())
}
