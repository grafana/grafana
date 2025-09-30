package preferences

import (
	"context"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	authlib "github.com/grafana/authlib/types"
	preferences "github.com/grafana/grafana/apps/preferences/pkg/apis/preferences/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

var _ grafanarest.Storage = (*starStorage)(nil)

type starStorage struct {
	store grafanarest.Storage
}

// When using list, we really just want to get the value for the single user
func (s *starStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
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
