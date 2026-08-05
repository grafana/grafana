package dashboard

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metainternalversion "k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	requestcontext "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type libraryPanelAuthorizer func(ctx context.Context, obj runtime.Object, verb, namespace string) error

// libraryPanelAccessStorage enforces write authorization at the storage boundary.
// This complements admission validation and covers standalone/hosted API servers,
// where the complete unified store can be invoked without the embedded admission path.
type libraryPanelAccessStorage struct {
	store     rest.StandardStorage
	table     rest.TableConvertor
	resource  schema.GroupResource
	authorize libraryPanelAuthorizer
}

var (
	_ rest.StandardStorage = (*libraryPanelAccessStorage)(nil)
	_ rest.TableConvertor  = (*libraryPanelAccessStorage)(nil)
)

func newLibraryPanelAccessStorage(store rest.StandardStorage, authorize libraryPanelAuthorizer) *libraryPanelAccessStorage {
	table, _ := store.(rest.TableConvertor)
	return &libraryPanelAccessStorage{
		store:     store,
		table:     table,
		resource:  schema.GroupResource{Group: "dashboard.grafana.app", Resource: "librarypanels"},
		authorize: authorize,
	}
}

func (s *libraryPanelAccessStorage) New() runtime.Object     { return s.store.New() }
func (s *libraryPanelAccessStorage) NewList() runtime.Object { return s.store.NewList() }
func (s *libraryPanelAccessStorage) Destroy()                { s.store.Destroy() }

func (s *libraryPanelAccessStorage) NamespaceScoped() bool { return true }

func (s *libraryPanelAccessStorage) GetSingularName() string { return "librarypanel" }

func (s *libraryPanelAccessStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	if s.table == nil {
		return nil, apierrors.NewInternalError(nil)
	}
	return s.table.ConvertToTable(ctx, object, tableOptions)
}

func (s *libraryPanelAccessStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.store.Get(ctx, name, options)
}

func (s *libraryPanelAccessStorage) List(ctx context.Context, options *metainternalversion.ListOptions) (runtime.Object, error) {
	return s.store.List(ctx, options)
}

func (s *libraryPanelAccessStorage) Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error) {
	return s.store.Watch(ctx, options)
}

func (s *libraryPanelAccessStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if err := s.authorize(ctx, obj, utils.VerbCreate, requestcontext.NamespaceValue(ctx)); err != nil {
		return nil, err
	}
	return s.store.Create(ctx, obj, createValidation, options)
}

type authorizingUpdatedObjectInfo struct {
	rest.UpdatedObjectInfo
	authorize libraryPanelAuthorizer
}

func (i authorizingUpdatedObjectInfo) UpdatedObject(ctx context.Context, oldObj runtime.Object) (runtime.Object, error) {
	obj, err := i.UpdatedObjectInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, err
	}
	if err := i.authorize(ctx, obj, utils.VerbUpdate, requestcontext.NamespaceValue(ctx)); err != nil {
		return nil, err
	}
	return obj, nil
}

func (s *libraryPanelAccessStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return s.store.Update(ctx, name, authorizingUpdatedObjectInfo{
		UpdatedObjectInfo: objInfo,
		authorize:         s.authorize,
	}, createValidation, updateValidation, forceAllowCreate, options)
}

func (s *libraryPanelAccessStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	obj, err := s.store.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}
	if err := s.authorize(ctx, obj, utils.VerbDelete, requestcontext.NamespaceValue(ctx)); err != nil {
		return nil, false, err
	}
	return s.store.Delete(ctx, name, deleteValidation, options)
}

func (s *libraryPanelAccessStorage) DeleteCollection(context.Context, rest.ValidateObjectFunc, *metav1.DeleteOptions, *metainternalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(s.resource, "deletecollection")
}
