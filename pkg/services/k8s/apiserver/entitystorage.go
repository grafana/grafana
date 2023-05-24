package apiserver

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/store/entity"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	"k8s.io/client-go/tools/cache"
)

var _ storage.Interface = (*entityStorage)(nil)

// Storage implements storage.Interface and storage resources as JSON files on disk.
type entityStorage struct {
	store        entity.EntityStoreServer
	gr           schema.GroupResource
	codec        runtime.Codec
	keyFunc      func(obj runtime.Object) (string, error)
	newFunc      func() runtime.Object
	newListFunc  func() runtime.Object
	getAttrsFunc storage.AttrFunc
	trigger      storage.IndexerFuncs
	indexers     *cache.Indexers
}

// ErrFileNotExists means the file doesn't actually exist.
var ErrFileNotExists = fmt.Errorf("file doesn't exist")

// ErrNamespaceNotExists means the directory for the namespace doesn't actually exist.
var ErrNamespaceNotExists = errors.New("namespace does not exist")

// NewStorage instantiates a new Storage.
func NewEntityStorage(
	store entity.EntityStoreServer,
	config *storagebackend.ConfigForResource,
	resourcePrefix string,
	keyFunc func(obj runtime.Object) (string, error),
	newFunc func() runtime.Object,
	newListFunc func() runtime.Object,
	getAttrsFunc storage.AttrFunc,
	trigger storage.IndexerFuncs,
	indexers *cache.Indexers,
) (storage.Interface, factory.DestroyFunc, error) {
	return &entityStorage{
		store:        store,
		gr:           config.GroupResource,
		codec:        config.Codec,
		keyFunc:      keyFunc,
		newFunc:      newFunc,
		newListFunc:  newListFunc,
		getAttrsFunc: getAttrsFunc,
		trigger:      trigger,
		indexers:     indexers,
	}, func() {}, nil
}

// Returns Versioner associated with this storage.
func (s *entityStorage) Versioner() storage.Versioner {
	return &storage.APIObjectVersioner{}
}

func (s *entityStorage) exists(ctx context.Context, grn *entity.GRN) bool {
	return false
}

func (s *entityStorage) toGRN(key string) (*entity.GRN, error) {
	return &entity.GRN{
		TenantId: 1, // TODO, from namespace? key?
		Kind:     s.gr.Resource,
		UID:      key, // TODO!!!
	}, nil
}

// Create adds a new object at a key unless it already exists. 'ttl' is time-to-live
// in seconds (0 means forever). If no error is returned and out is not nil, out will be
// set to the read value from database.
func (s *entityStorage) Create(ctx context.Context, key string, obj runtime.Object, out runtime.Object, ttl uint64) error {
	grn, err := s.toGRN(key)
	if err != nil {
		return err
	}

	if s.exists(ctx, grn) {
		return apierrors.NewAlreadyExists(s.gr, key)
	}

	if err := s.Versioner().PrepareObjectForStorage(obj); err != nil {
		return err
	}

	s.store.Write(ctx, &entity.WriteEntityRequest{
		GRN:  grn,
		Body: make([]byte, 0),
	})

	// TODO:
	// - notify watchers
	// - what to do with ttl?
	out = obj.DeepCopyObject()

	return fmt.Errorf("unimplemented")
}

// Delete removes the specified key and returns the value that existed at that spot.
// If key didn't exist, it will return NotFound storage error.
// If 'cachedExistingObject' is non-nil, it can be used as a suggestion about the
// current version of the object to avoid read operation from storage to get it.
// However, the implementations have to retry in case suggestion is stale.
func (s *entityStorage) Delete(
	ctx context.Context, key string, out runtime.Object, preconditions *storage.Preconditions,
	validateDeletion storage.ValidateObjectFunc, cachedExistingObject runtime.Object) error {
	grn, err := s.toGRN(key)
	if err != nil {
		return err
	}

	if !s.exists(ctx, grn) {
		return apierrors.NewNotFound(s.gr, grn.UID)
	}

	if cachedExistingObject != nil {
		out = cachedExistingObject.DeepCopyObject()
	} else {
		if err := s.Get(ctx, key, storage.GetOptions{}, out); err != nil {
			return err
		}
	}

	if preconditions != nil {
		if err := preconditions.Check(key, out); err != nil {
			return err
		}
	}

	if err := validateDeletion(ctx, out); err != nil {
		return err
	}

	rsp, err := s.store.Delete(ctx, &entity.DeleteEntityRequest{
		GRN: grn,
	})
	if err == nil && !rsp.OK {
		return fmt.Errorf("did not delte")
	}
	return err
}

// Watch begins watching the specified key. Events are decoded into API objects,
// and any items selected by 'p' are sent down to returned watch.Interface.
// resourceVersion may be used to specify what version to begin watching,
// which should be the current resourceVersion, and no longer rv+1
// (e.g. reconnecting without missing any updates).
// If resource version is "0", this interface will get current object at given key
// and send it in an "ADDED" event, before watch starts.
func (s *entityStorage) Watch(ctx context.Context, key string, opts storage.ListOptions) (watch.Interface, error) {
	return nil, fmt.Errorf("not implemented")
}

// Get unmarshals object found at key into objPtr. On a not found error, will either
// return a zero object of the requested type, or an error, depending on 'opts.ignoreNotFound'.
// Treats empty responses and nil response nodes exactly like a not found error.
// The returned contents may be delayed, but it is guaranteed that they will
// match 'opts.ResourceVersion' according 'opts.ResourceVersionMatch'.
func (s *entityStorage) Get(ctx context.Context, key string, opts storage.GetOptions, objPtr runtime.Object) error {
	grn, err := s.toGRN(key)

	rsp, err := s.store.Read(ctx, &entity.ReadEntityRequest{
		GRN:      grn,
		WithBody: true,
	})
	if err != nil {
		return err
	}

	fmt.Print("GOT:" + rsp.ETag)

	// ?????
	obj := s.newFunc()
	objPtr = obj.DeepCopyObject()

	return nil
}

// GetList unmarshalls objects found at key into a *List api object (an object
// that satisfies runtime.IsList definition).
// If 'opts.Recursive' is false, 'key' is used as an exact match. If `opts.Recursive'
// is true, 'key' is used as a prefix.
// The returned contents may be delayed, but it is guaranteed that they will
// match 'opts.ResourceVersion' according 'opts.ResourceVersionMatch'.
func (s *entityStorage) GetList(ctx context.Context, key string, opts storage.ListOptions, listObj runtime.Object) error {
	if key == "" {
		return fmt.Errorf("list requires a namespace (for now)")
	}

	rsp, err := s.store.Search(ctx, &entity.EntitySearchRequest{
		Kind:     []string{s.gr.Resource},
		WithBody: true,
	})
	if err != nil {
		return err
	}

	u := listObj.(*unstructured.UnstructuredList)
	u.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   s.gr.Group,
		Version: "v1alpha1",
		Kind:    "DashboardList",
	})
	u.SetResourceVersion(opts.ResourceVersion) // ???

	for _, r := range rsp.Results {
		obj := s.newFunc()
		// convert r to object pointer???
		fmt.Printf("FOUND:" + r.Slug)

		resource, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
		if err != nil {
			return err
		}
		u.Items = append(u.Items, unstructured.Unstructured{Object: resource})
	}

	return nil
}

// GuaranteedUpdate keeps calling 'tryUpdate()' to update key 'key' (of type 'destination')
// retrying the update until success if there is index conflict.
// Note that object passed to tryUpdate may change across invocations of tryUpdate() if
// other writers are simultaneously updating it, so tryUpdate() needs to take into account
// the current contents of the object when deciding how the update object should look.
// If the key doesn't exist, it will return NotFound storage error if ignoreNotFound=false
// else `destination` will be set to the zero value of it's type.
// If the eventual successful invocation of `tryUpdate` returns an output with the same serialized
// contents as the input, it won't perform any update, but instead set `destination` to an object with those
// contents.
// If 'cachedExistingObject' is non-nil, it can be used as a suggestion about the
// current version of the object to avoid read operation from storage to get it.
// However, the implementations have to retry in case suggestion is stale.
func (s *entityStorage) GuaranteedUpdate(
	ctx context.Context, key string, destination runtime.Object, ignoreNotFound bool,
	preconditions *storage.Preconditions, tryUpdate storage.UpdateFunc, cachedExistingObject runtime.Object) error {
	return nil
}

// Count returns number of different entries under the key (generally being path prefix).
func (s *entityStorage) Count(key string) (int64, error) {
	return 0, nil
}
