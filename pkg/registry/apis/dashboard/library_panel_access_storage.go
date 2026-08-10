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
type libraryPanelUpdateAuthorizer func(ctx context.Context, oldObj, newObj runtime.Object, namespace string) error

// libraryPanelAccessStorage enforces writes at the standalone storage boundary.
// Standalone app-platform API servers do not reliably populate old objects for
// update/delete admission, so admission alone can otherwise allow those writes.
// Materializing UpdatedObjectInfo here also gives PATCH the existing object it
// needs before the unified store performs the update.
type libraryPanelAccessStorage struct {
	store           rest.StandardStorage
	table           rest.TableConvertor
	resource        schema.GroupResource
	authorize       libraryPanelAuthorizer
	authorizeUpdate libraryPanelUpdateAuthorizer
}

var (
	_ rest.StandardStorage = (*libraryPanelAccessStorage)(nil)
	_ rest.TableConvertor  = (*libraryPanelAccessStorage)(nil)
)

func newLibraryPanelAccessStorage(
	store rest.StandardStorage,
	authorize libraryPanelAuthorizer,
	authorizeUpdate libraryPanelUpdateAuthorizer,
) *libraryPanelAccessStorage {
	table, _ := store.(rest.TableConvertor)
	return &libraryPanelAccessStorage{
		store:           store,
		table:           table,
		resource:        schema.GroupResource{Group: "dashboard.grafana.app", Resource: "librarypanels"},
		authorize:       authorize,
		authorizeUpdate: authorizeUpdate,
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

func (s *libraryPanelAccessStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	oldObj, err := s.store.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}
	// Keep the fetched object immutable so a patch transformer that mutates its
	// input cannot erase the source folder before move authorization runs.
	newObj, err := objInfo.UpdatedObject(ctx, oldObj.DeepCopyObject())
	if err != nil {
		return nil, false, err
	}
	if err := s.authorizeUpdate(ctx, oldObj, newObj, requestcontext.NamespaceValue(ctx)); err != nil {
		return nil, false, err
	}

	return s.store.Update(
		ctx,
		name,
		rest.DefaultUpdatedObjectInfo(newObj),
		createValidation,
		updateValidation,
		forceAllowCreate,
		options,
	)
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
