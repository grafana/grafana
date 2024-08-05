package collection

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	collection "github.com/grafana/grafana/pkg/apis/collection/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
)

var (
	_ rest.Scoper               = (*legacyStarsStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStarsStorage)(nil)
	_ rest.Getter               = (*legacyStarsStorage)(nil)
	_ rest.Lister               = (*legacyStarsStorage)(nil)
	_ rest.Storage              = (*legacyStarsStorage)(nil)
	_ rest.Creater              = (*legacyStarsStorage)(nil)
	_ rest.Updater              = (*legacyStarsStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStarsStorage)(nil)
)

var starsResourceInfo = collection.CollectionResourceInfo

type legacyStarsStorage struct {
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyStarsStorage) New() runtime.Object {
	return starsResourceInfo.NewFunc()
}

func (s *legacyStarsStorage) Destroy() {}

func (s *legacyStarsStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStarsStorage) GetSingularName() string {
	return starsResourceInfo.GetSingularName()
}

func (s *legacyStarsStorage) NewList() runtime.Object {
	return starsResourceInfo.NewListFunc()
}

func (s *legacyStarsStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStarsStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return nil, nil
}

func (s *legacyStarsStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	fmt.Printf("GET: %v/%v\n", info, user)
	return nil, nil
}

func (s *legacyStarsStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	p, ok := obj.(*collection.Collection)
	if !ok {
		return nil, fmt.Errorf("expected folder?")
	}

	fmt.Printf("CREATE: %v\n", p)

	return nil, fmt.Errorf("not yet")
}

func (s *legacyStarsStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	created := false
	oldObj, err := s.Get(ctx, name, nil)
	if err != nil {
		return oldObj, created, err
	}

	obj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return oldObj, created, err
	}
	f, ok := obj.(*collection.Collection)
	if !ok {
		return nil, created, fmt.Errorf("expected folder after update")
	}
	old, ok := oldObj.(*collection.Collection)
	if !ok {
		return nil, created, fmt.Errorf("expected old object to be a folder also")
	}

	fmt.Printf("UPDATE: %v/%v/%v/%v\n", f, old, user, info)

	return nil, created, fmt.Errorf("not yet")
}

// GracefulDeleter
func (s *legacyStarsStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	v, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return v, false, err // includes the not-found error
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}
	p, ok := v.(*collection.Collection)
	if !ok {
		return v, false, fmt.Errorf("expected a folder response from Get")
	}

	fmt.Printf("DELETE: %v/%v/%v\n", p, user, info)
	return p, true, err // true is instant delete
}

// GracefulDeleter
func (s *legacyStarsStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for folders not implemented")
}
