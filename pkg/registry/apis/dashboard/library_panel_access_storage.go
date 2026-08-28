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
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type libraryPanelAuthorizer func(ctx context.Context, obj runtime.Object, verb, namespace string) error
type libraryPanelUpdateAuthorizer func(ctx context.Context, oldObj, newObj runtime.Object, namespace string) error
type libraryPanelDeleteValidator func(ctx context.Context, name, namespace string) error
type libraryPanelFolderValidator func(ctx context.Context, obj runtime.Object) error

type libraryPanelStorage interface {
	rest.Storage
	rest.Getter
	rest.Lister
	rest.CreaterUpdater
	rest.GracefulDeleter
}

// libraryPanelAccessStorage enforces writes at the storage boundary.
// App-platform API servers do not reliably populate old objects for
// update/delete admission, so admission alone can otherwise allow those writes.
// Materializing UpdatedObjectInfo here also gives PATCH the existing object it
// needs before the unified store performs the update.
type libraryPanelAccessStorage struct {
	store           libraryPanelStorage
	table           rest.TableConvertor
	resource        schema.GroupResource
	authorize       libraryPanelAuthorizer
	authorizeUpdate libraryPanelUpdateAuthorizer
	validateDelete  libraryPanelDeleteValidator
	validateFolder  libraryPanelFolderValidator
}

var (
	_ libraryPanelStorage    = (*libraryPanelAccessStorage)(nil)
	_ rest.TableConvertor    = (*libraryPanelAccessStorage)(nil)
	_ rest.Watcher           = (*libraryPanelAccessStorageWithWatch)(nil)
	_ rest.CollectionDeleter = (*libraryPanelAccessStorageWithDeleteCollection)(nil)
)

type libraryPanelAccessStorageWithWatch struct {
	*libraryPanelAccessStorage
	watcher rest.Watcher
}

type libraryPanelAccessStorageWithDeleteCollection struct {
	*libraryPanelAccessStorage
}

type libraryPanelAccessStorageWithWatchAndDeleteCollection struct {
	*libraryPanelAccessStorageWithDeleteCollection
	watcher rest.Watcher
}

func newLibraryPanelAccessStorage(
	store libraryPanelStorage,
	authorize libraryPanelAuthorizer,
	authorizeUpdate libraryPanelUpdateAuthorizer,
	validateDelete libraryPanelDeleteValidator,
	validateFolder libraryPanelFolderValidator,
) libraryPanelStorage {
	table, _ := store.(rest.TableConvertor)
	storage := &libraryPanelAccessStorage{
		store:           store,
		table:           table,
		resource:        schema.GroupResource{Group: "dashboard.grafana.app", Resource: "librarypanels"},
		authorize:       authorize,
		authorizeUpdate: authorizeUpdate,
		validateDelete:  validateDelete,
		validateFolder:  validateFolder,
	}
	watcher, canWatch := store.(rest.Watcher)
	_, canDeleteCollection := store.(rest.CollectionDeleter)
	switch {
	case canWatch && canDeleteCollection:
		return &libraryPanelAccessStorageWithWatchAndDeleteCollection{
			libraryPanelAccessStorageWithDeleteCollection: &libraryPanelAccessStorageWithDeleteCollection{
				libraryPanelAccessStorage: storage,
			},
			watcher: watcher,
		}
	case canWatch:
		return &libraryPanelAccessStorageWithWatch{
			libraryPanelAccessStorage: storage,
			watcher:                   watcher,
		}
	case canDeleteCollection:
		return &libraryPanelAccessStorageWithDeleteCollection{libraryPanelAccessStorage: storage}
	}
	return storage
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

func (s *libraryPanelAccessStorageWithWatch) Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error) {
	return s.watcher.Watch(ctx, options)
}

func (s *libraryPanelAccessStorageWithWatchAndDeleteCollection) Watch(ctx context.Context, options *metainternalversion.ListOptions) (watch.Interface, error) {
	return s.watcher.Watch(ctx, options)
}

func (s *libraryPanelAccessStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	if err := s.authorize(ctx, obj, utils.VerbCreate, requestcontext.NamespaceValue(ctx)); err != nil {
		return nil, err
	}
	if err := s.validateFolder(ctx, obj); err != nil {
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
	oldName, oldFolder, err := libraryPanelAuthorizationTarget(oldObj)
	if err != nil {
		return nil, false, err
	}
	newName, newFolder, err := libraryPanelAuthorizationTarget(newObj)
	if err != nil {
		return nil, false, err
	}
	if (oldName != newName || oldFolder != newFolder) && newFolder != accesscontrol.GeneralFolderUID {
		if err := s.validateFolder(ctx, newObj); err != nil {
			return nil, false, err
		}
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
	if err := s.validateDelete(ctx, name, requestcontext.NamespaceValue(ctx)); err != nil {
		return nil, false, err
	}
	return s.store.Delete(ctx, name, deleteValidation, options)
}

func (s *libraryPanelAccessStorageWithDeleteCollection) DeleteCollection(context.Context, rest.ValidateObjectFunc, *metav1.DeleteOptions, *metainternalversion.ListOptions) (runtime.Object, error) {
	return nil, apierrors.NewMethodNotSupported(s.resource, "deletecollection")
}
