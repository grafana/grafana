package preferences

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
)

type starItem struct {
	group string
	kind  string
	id    string
}

type starsREST struct {
	getter rest.Getter
	writer rest.CreaterUpdater
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

		obj, err := r.getter.Get(ctx, name, &metav1.GetOptions{})
		if err != nil {
			if storage.IsNotFound(err) {
				obj = &preferences.Stars{ObjectMeta: metav1.ObjectMeta{Name: name}}
				if req.Method == "Delete" {
					responder.Object(http.StatusNoContent, obj)
					return
				}
			} else {
				responder.Error(err)
				return
			}
		}
		stars, ok := obj.(*preferences.Stars)
		if !ok {
			responder.Error(fmt.Errorf("expected stars"))
			return
		}

		status := http.StatusAccepted
		changed := updateStars(stars, item, req.Method == "DELETE")
		if changed {
			// TODO... actually write it!
			status = http.StatusOK
		}
		responder.Object(status, stars)
	}), nil
}

func updateStars(stars *preferences.Stars, item starItem, remove bool) bool {
	idx := slices.IndexFunc(stars.Spec.Resource, func(v preferences.StarsResource) bool {
		return v.Group == item.group && v.Kind == item.kind
	})
	if idx < 0 {
		if remove {
			return false
		}
		stars.Spec.Resource = append(stars.Spec.Resource, preferences.StarsResource{
			Group: item.group,
			Kind:  item.kind,
		})
		idx = len(stars.Spec.Resource) - 1
	}

	if remove {
		found := false
		shorter := slices.DeleteFunc(stars.Spec.Resource[idx].Names, func(v string) bool {
			if v == item.id {
				found = true
				return true
			}
			return false
		})
		if found {
			stars.Spec.Resource[idx].Names = shorter
		}
		return found
	}

	found := slices.Contains(stars.Spec.Resource[idx].Names, item.id)
	if found {
		return false
	}
	stars.Spec.Resource[idx].Names = append(stars.Spec.Resource[idx].Names, item.id)
	slices.Sort(stars.Spec.Resource[idx].Names)
	return true
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
