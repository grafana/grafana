package preferences

import (
	"context"
	"fmt"
	"net/http"
	"slices"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/preferences/utils"
)

var _ grafanarest.Storage = (*starStorage)(nil)

type starStorage struct {
	store grafanarest.Storage
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
	if user.GetIdentifier() != parsed.Name {
		return nil, fmt.Errorf("must request as the given user")
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		item, err := itemFromPath(req.URL.Path, fmt.Sprintf("/%s/write", name))
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

		if !apply(&obj.Spec, item, remove) {
			responder.Object(http.StatusNoContent, &v1.Status{
				Code: http.StatusNoContent,
			})
			return
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
		responder.Object(http.StatusOK, &v1.Status{
			Code: http.StatusOK,
		})
	}), nil
}

func itemFromPath(urlPath, prefix string) (starItem, error) {
	idx := strings.Index(urlPath, prefix)
	if idx == -1 {
		return starItem{}, apierrors.NewBadRequest("invalid request path")
	}

	switch user.GetIdentityType() {
	case authlib.TypeAnonymous:
		return s.NewList(), nil

	// Get the single user stars
	case authlib.TypeUser:
		stars := &preferences.StarsList{}
		obj, _ := s.store.Get(ctx, "user-"+user.GetIdentifier(), &v1.GetOptions{})
		if obj != nil {
			s, ok := obj.(*preferences.Stars)
			if ok {
				stars.Items = []preferences.Stars{*s}
			}
		}
		return stars, nil

	default:
		return s.store.List(ctx, options)
	}
}

// ConvertToTable implements rest.Storage.
func (s *starStorage) ConvertToTable(ctx context.Context, obj runtime.Object, tableOptions runtime.Object) (*v1.Table, error) {
	return s.store.ConvertToTable(ctx, obj, tableOptions)
}

// Create implements rest.Storage.
func (s *starStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *v1.CreateOptions) (runtime.Object, error) {
	return s.store.Create(ctx, obj, createValidation, options)
}

// Delete implements rest.Storage.
func (s *starStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *v1.DeleteOptions) (runtime.Object, bool, error) {
	return s.store.Delete(ctx, name, deleteValidation, options)
}

// DeleteCollection implements rest.Storage.
func (s *starStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *v1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return s.store.DeleteCollection(ctx, deleteValidation, options, listOptions)
}

// Destroy implements rest.Storage.
func (s *starStorage) Destroy() {
	s.store.Destroy()
}

// Get implements rest.Storage.
func (s *starStorage) Get(ctx context.Context, name string, options *v1.GetOptions) (runtime.Object, error) {
	return s.store.Get(ctx, name, options)
}

// GetSingularName implements rest.Storage.
func (s *starStorage) GetSingularName() string {
	return s.store.GetSingularName()
}

// NamespaceScoped implements rest.Storage.
func (s *starStorage) NamespaceScoped() bool {
	return s.store.NamespaceScoped()
}

// New implements rest.Storage.
func (s *starStorage) New() runtime.Object {
	return s.store.New()
}

// NewList implements rest.Storage.
func (s *starStorage) NewList() runtime.Object {
	return s.store.NewList()
}

// Update implements rest.Storage.
func (s *starStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *v1.UpdateOptions) (runtime.Object, bool, error) {
	return s.store.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
}

func apply(spec *preferences.StarsSpec, item starItem, remove bool) bool {
	var stars *preferences.StarsResource
	for idx, v := range spec.Resource {
		if v.Group == item.group && v.Kind == item.kind {
			stars = &spec.Resource[idx]
		}
	}
	if stars == nil {
		if remove {
			return false
		}
		spec.Resource = append(spec.Resource, preferences.StarsResource{
			Group: item.group,
			Kind:  item.kind,
			Names: []string{},
		})
		stars = &spec.Resource[len(spec.Resource)-1]
	}

	idx := slices.Index(stars.Names, item.id)
	if idx < 0 { // not found
		if remove {
			return false
		}
		stars.Names = append(stars.Names, item.id)
	} else if remove {
		stars.Names = append(stars.Names[:idx], stars.Names[idx+1:]...)
	} else {
		return false
	}
	slices.Sort(stars.Names)

	// Remove the slot if only one value
	if len(stars.Names) == 0 {
		tmp := preferences.StarsSpec{}
		for _, v := range spec.Resource {
			if v.Group == item.group && v.Kind == item.kind {
				continue
			}
			tmp.Resource = append(tmp.Resource, v)
		}
		spec.Resource = tmp.Resource
	}
	return true
}
