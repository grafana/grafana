package preferences

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

type starItem struct {
	group string
	kind  string
	id    string
}

type starsREST struct {
	store grafanarest.Storage
}

var (
	_ = rest.Connecter(&starsREST{})
	_ = rest.StorageMetadata(&starsREST{})
)

func (r *starsREST) New() runtime.Object {
	return &preferences.Stars{}
}

func (r *starsREST) Destroy() {}

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
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, fmt.Errorf("must be logged in")
	}
	parsed, found := utils.ParseOwnerFromName(name)
	if !found || parsed.Owner != utils.UserResourceOwner {
		return nil, fmt.Errorf("only works with user stars")
	}
	if user.GetIdentifier() != parsed.Identifier {
		return nil, fmt.Errorf("must request as the given user")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		item, err := itemFromPath(req.URL.Path, fmt.Sprintf("/%s/update", name))
		if err != nil {
			responder.Error(err)
			return
		}

		remove := false
		switch req.Method {
		case "DELETE":
			remove = true
		case "PUT":
			remove = false
		default:
			responder.Error(apierrors.NewMethodNotSupported(preferences.PreferencesResourceInfo.GroupResource(), req.Method))
			return
		}

		current, err := r.store.Get(ctx, name, &v1.GetOptions{})
		if err != nil {
			if apierrors.IsNotFound(err) {
				if remove {
					responder.Object(http.StatusNoContent, &v1.Status{
						Code: http.StatusNoContent,
					})
					return
				}
				current = &preferences.Stars{
					ObjectMeta: v1.ObjectMeta{
						Name:      name,
						Namespace: user.GetNamespace(),
					},
				}
			}
		}

		obj, ok := current.(*preferences.Stars)
		if !ok {
			responder.Error(fmt.Errorf("expected stars object"))
			return
		}

		if remove {
			obj.Spec.Remove(item.group, item.kind, item.id)
		} else {
			obj.Spec.Add(item.group, item.kind, item.id)
		}

		if len(obj.Spec.Resource) == 0 {
			_, _, err = r.store.Delete(ctx, name, rest.ValidateAllObjectFunc, &v1.DeleteOptions{})
		} else if obj.ResourceVersion == "" {
			_, err = r.store.Create(ctx, obj, rest.ValidateAllObjectFunc, &v1.CreateOptions{})
		} else {
			_, _, err = r.store.Update(ctx, name, rest.DefaultUpdatedObjectInfo(obj), rest.ValidateAllObjectFunc, rest.ValidateAllObjectUpdateFunc, true, &v1.UpdateOptions{})
		}
		if err != nil {
			responder.Error(err)
			return
		}
		responder.Object(http.StatusOK, &v1.Status{Code: http.StatusOK})
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
