package preferences

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/legacy"
)

type starItem struct {
	group string
	kind  string
	id    string
}

type starsREST struct {
	store *legacy.DashboardStarsStorage
}

var (
	_ = rest.Connecter(&starsREST{})
	_ = rest.StorageMetadata(&starsREST{})
)

func (r *starsREST) New() runtime.Object {
	return &preferences.Stars{}
}

func (r *starsREST) Destroy() {
}

func (r *starsREST) ConnectMethods() []string {
	return []string{"PUT", "DELETE"}
}

func (r *starsREST) ProducesMIMETypes(verb string) []string {
	return nil
}

func (r *starsREST) ProducesObject(verb string) interface{} {
	return &preferences.Stars{}
}

func (r *starsREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, "" // true means you can use the trailing path as a variable
}

func (r *starsREST) Connect(ctx context.Context, name string, _ runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		item, err := itemFromPath(req.URL.Path, fmt.Sprintf("/%s/write", name))
		if err != nil {
			responder.Error(err)
			return
		}

		if item.group != "dashboard.grafana.app" || item.kind != "Dashboard" {
			responder.Error(fmt.Errorf("only dashboards are supported right now"))
			return
		}

		var obj runtime.Object
		switch req.Method {
		case "DELETE":
			obj, err = r.store.UnstarDashboard(ctx, name, item.id)
		case "PUT":
			obj, err = r.store.StarDashboard(ctx, name, item.id)
		default:
			err = fmt.Errorf("unsupported method")
		}
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(200, obj)
	}), nil
}

func itemFromPath(urlPath, prefix string) (starItem, error) {
	idx := strings.Index(urlPath, prefix)
	if idx == -1 {
		return starItem{}, apierrors.NewBadRequest("invalid request path")
	}

	path := strings.TrimPrefix(urlPath[idx+len(prefix):], "/")
	parts := strings.Split(path, "/")
	if len(parts) != 3 {
		return starItem{}, apierrors.NewBadRequest("expected {group}/{kind}/{id}")
	}
	return starItem{
		group: parts[0],
		kind:  parts[1],
		id:    parts[2],
	}, nil
}
