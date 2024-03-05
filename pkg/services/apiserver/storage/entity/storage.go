// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes-sigs/apiserver-runtime/blob/main/pkg/experimental/storage/filepath/jsonfile_rest.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package entity

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log"
	"reflect"
	"strconv"

	grpcCodes "google.golang.org/grpc/codes"
	grpcStatus "google.golang.org/grpc/status"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"

	entityStore "github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/util"
)

var _ storage.Interface = (*Storage)(nil)

const MaxUpdateAttempts = 1

// Storage implements storage.Interface and storage resources as JSON files on disk.
type Storage struct {
	config       *storagebackend.ConfigForResource
	store        entityStore.EntityStoreClient
	gr           schema.GroupResource
	codec        runtime.Codec
	keyFunc      func(obj runtime.Object) (string, error)
	newFunc      func() runtime.Object
	newListFunc  func() runtime.Object
	getAttrsFunc storage.AttrFunc
	// trigger      storage.IndexerFuncs
	// indexers     *cache.Indexers

	// watchSet *WatchSet
}

func NewStorage(
	config *storagebackend.ConfigForResource,
	gr schema.GroupResource,
	store entityStore.EntityStoreClient,
	codec runtime.Codec,
	keyFunc func(obj runtime.Object) (string, error),
	newFunc func() runtime.Object,
	newListFunc func() runtime.Object,
	getAttrsFunc storage.AttrFunc,
) (storage.Interface, factory.DestroyFunc, error) {
	return &Storage{
		config:       config,
		gr:           gr,
		codec:        codec,
		store:        store,
		keyFunc:      keyFunc,
		newFunc:      newFunc,
		newListFunc:  newListFunc,
		getAttrsFunc: getAttrsFunc,
	}, nil, nil
}

// Create adds a new object at a key unless it already exists. 'ttl' is time-to-live
// in seconds (0 means forever). If no error is returned and out is not nil, out will be
// set to the read value from database.
func (s *Storage) Create(ctx context.Context, key string, obj runtime.Object, out runtime.Object, ttl uint64) error {
	requestInfo, ok := request.RequestInfoFrom(ctx)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("could not get request info"))
	}

	if err := s.Versioner().PrepareObjectForStorage(obj); err != nil {
		return err
	}

	metaAccessor, err := meta.Accessor(obj)
	if err != nil {
		return err
	}

	// Replace the default name generation strategy
	if metaAccessor.GetGenerateName() != "" {
		k, err := entityStore.ParseKey(key)
		if err != nil {
			return err
		}
		k.Name = util.GenerateShortUID()
		key = k.String()

		metaAccessor.SetName(k.Name)
		metaAccessor.SetGenerateName("")
	}

	e, err := resourceToEntity(key, obj, requestInfo, s.codec)
	if err != nil {
		return err
	}

	req := &entityStore.CreateEntityRequest{
		Entity: e,
	}

	rsp, err := s.store.Create(ctx, req)
	if err != nil {
		return err
	}
	if rsp.Status != entityStore.CreateEntityResponse_CREATED {
		return fmt.Errorf("this was not a create operation... (%s)", rsp.Status.String())
	}

	err = entityToResource(rsp.Entity, out, s.codec)
	if err != nil {
		return apierrors.NewInternalError(err)
	}

	/*
		s.watchSet.notifyWatchers(watch.Event{
			Object: out.DeepCopyObject(),
			Type:   watch.Added,
		})
	*/

	return nil
}

// Delete removes the specified key and returns the value that existed at that spot.
// If key didn't exist, it will return NotFound storage error.
// If 'cachedExistingObject' is non-nil, it can be used as a suggestion about the
// current version of the object to avoid read operation from storage to get it.
// However, the implementations have to retry in case suggestion is stale.
func (s *Storage) Delete(ctx context.Context, key string, out runtime.Object, preconditions *storage.Preconditions, validateDeletion storage.ValidateObjectFunc, cachedExistingObject runtime.Object) error {
	previousVersion := int64(0)
	if preconditions != nil && preconditions.ResourceVersion != nil {
		previousVersion, _ = strconv.ParseInt(*preconditions.ResourceVersion, 10, 64)
	}

	rsp, err := s.store.Delete(ctx, &entityStore.DeleteEntityRequest{
		Key:             key,
		PreviousVersion: previousVersion,
	})
	if err != nil {
		return err
	}

	err = entityToResource(rsp.Entity, out, s.codec)
	if err != nil {
		return apierrors.NewInternalError(err)
	}

	return nil
}

type Decoder struct {
	client  entityStore.EntityStore_WatchClient
	newFunc func() runtime.Object
	opts    storage.ListOptions
	codec   runtime.Codec
}

func (d *Decoder) Decode() (action watch.EventType, object runtime.Object, err error) {
	for {
		resp, err := d.client.Recv()
		if errors.Is(err, io.EOF) {
			log.Printf("watch is done")
			return watch.Error, nil, err
		}

		if grpcStatus.Code(err) == grpcCodes.Canceled {
			log.Printf("watch was canceled")
			return watch.Error, nil, err
		}

		if err != nil {
			log.Printf("error receiving result: %s", err)
			return watch.Error, nil, err
		}

		obj := d.newFunc()

		err = entityToResource(resp.Entity, obj, d.codec)
		if err != nil {
			log.Printf("error decoding entity: %s", err)
			return watch.Error, nil, err
		}

		// apply any predicates not handled in storage
		var matches bool
		matches, err = d.opts.Predicate.Matches(obj)
		if err != nil {
			log.Printf("error matching object: %s", err)
			return watch.Error, nil, err
		}
		if !matches {
			continue
		}

		var watchAction watch.EventType
		switch resp.Entity.Action {
		case entityStore.Entity_CREATED:
			watchAction = watch.Added
		case entityStore.Entity_UPDATED:
			watchAction = watch.Modified
		case entityStore.Entity_DELETED:
			watchAction = watch.Deleted
		default:
			watchAction = watch.Error
		}

		return watchAction, obj, nil
	}
}

func (d *Decoder) Close() {
	_ = d.client.CloseSend()
}

var _ watch.Decoder = (*Decoder)(nil)

// Watch begins watching the specified key. Events are decoded into API objects,
// and any items selected by 'p' are sent down to returned watch.Interface.
// resourceVersion may be used to specify what version to begin watching,
// which should be the current resourceVersion, and no longer rv+1
// (e.g. reconnecting without missing any updates).
// If resource version is "0", this interface will get current object at given key
// and send it in an "ADDED" event, before watch starts.
func (s *Storage) Watch(ctx context.Context, key string, opts storage.ListOptions) (watch.Interface, error) {
	req := &entityStore.EntityWatchRequest{
		Key:      []string{key},
		WithBody: true,
	}

	if opts.ResourceVersion != "" {
		rv, err := strconv.ParseInt(opts.ResourceVersion, 10, 64)
		if err != nil {
			return nil, apierrors.NewBadRequest(fmt.Sprintf("invalid resource version: %s", opts.ResourceVersion))
		}

		req.Since = rv
	}

	result, err := s.store.Watch(ctx, req)
	if err != nil {
		return nil, err
	}

	reporter := apierrors.NewClientErrorReporter(500, "WATCH", "")

	decoder := &Decoder{
		client:  result,
		newFunc: s.newFunc,
		opts:    opts,
		codec:   s.codec,
	}

	w := watch.NewStreamWatcher(decoder, reporter)

	return w, nil
}

// Get unmarshals object found at key into objPtr. On a not found error, will either
// return a zero object of the requested type, or an error, depending on 'opts.ignoreNotFound'.
// Treats empty responses and nil response nodes exactly like a not found error.
// The returned contents may be delayed, but it is guaranteed that they will
// match 'opts.ResourceVersion' according 'opts.ResourceVersionMatch'.
func (s *Storage) Get(ctx context.Context, key string, opts storage.GetOptions, objPtr runtime.Object) error {
	resourceVersion := int64(0)
	var err error
	if opts.ResourceVersion != "" {
		resourceVersion, err = strconv.ParseInt(opts.ResourceVersion, 10, 64)
		if err != nil {
			return apierrors.NewBadRequest(fmt.Sprintf("invalid resource version: %s", opts.ResourceVersion))
		}
	}

	rsp, err := s.store.Read(ctx, &entityStore.ReadEntityRequest{
		Key:             key,
		WithBody:        true,
		WithStatus:      true,
		ResourceVersion: resourceVersion,
	})
	if err != nil {
		return err
	}

	if rsp.Key == "" {
		if opts.IgnoreNotFound {
			return nil
		}

		return apierrors.NewNotFound(s.gr, key)
	}

	err = entityToResource(rsp, objPtr, s.codec)
	if err != nil {
		return apierrors.NewInternalError(err)
	}

	return nil
}

// GetList unmarshalls objects found at key into a *List api object (an object
// that satisfies runtime.IsList definition).
// If 'opts.Recursive' is false, 'key' is used as an exact match. If `opts.Recursive'
// is true, 'key' is used as a prefix.
// The returned contents may be delayed, but it is guaranteed that they will
// match 'opts.ResourceVersion' according 'opts.ResourceVersionMatch'.
func (s *Storage) GetList(ctx context.Context, key string, opts storage.ListOptions, listObj runtime.Object) error {
	listPtr, err := meta.GetItemsPtr(listObj)
	if err != nil {
		return err
	}
	v, err := conversion.EnforcePtr(listPtr)
	if err != nil {
		return err
	}

	req := &entityStore.EntityListRequest{
		Key:           []string{key},
		WithBody:      true,
		WithStatus:    true,
		NextPageToken: opts.Predicate.Continue,
		Limit:         opts.Predicate.Limit,
		Labels:        map[string]string{},
		// TODO push label/field matching down to storage
	}

	// translate grafana.app/* label selectors into field requirements
	requirements, newSelector, err := ReadLabelSelectors(opts.Predicate.Label)
	if err != nil {
		return err
	}
	if requirements.Folder != nil {
		req.Folder = *requirements.Folder
	}
	if len(requirements.SortBy) > 0 {
		req.Sort = requirements.SortBy
	}
	// Update the selector to remove the unneeded requirements
	opts.Predicate.Label = newSelector

	// translate "equals" label selectors to storage label conditions
	labelRequirements, selectable := opts.Predicate.Label.Requirements()
	if !selectable {
		return apierrors.NewBadRequest("label selector is not selectable")
	}

	for _, r := range labelRequirements {
		if r.Operator() == selection.Equals {
			req.Labels[r.Key()] = r.Values().List()[0]
		}
	}

	rsp, err := s.store.List(ctx, req)
	if err != nil {
		return apierrors.NewInternalError(err)
	}

	for _, r := range rsp.Results {
		res := s.newFunc()

		err := entityToResource(r, res, s.codec)
		if err != nil {
			return apierrors.NewInternalError(err)
		}

		// TODO filter in storage
		matches, err := opts.Predicate.Matches(res)
		if err != nil {
			return apierrors.NewInternalError(err)
		}
		if !matches {
			continue
		}

		v.Set(reflect.Append(v, reflect.ValueOf(res).Elem()))
	}

	listAccessor, err := meta.ListAccessor(listObj)
	if err != nil {
		return err
	}

	if rsp.NextPageToken != "" {
		listAccessor.SetContinue(rsp.NextPageToken)
	}

	listAccessor.SetResourceVersion(strconv.FormatInt(rsp.ResourceVersion, 10))

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
func (s *Storage) GuaranteedUpdate(
	ctx context.Context,
	key string,
	destination runtime.Object,
	ignoreNotFound bool,
	preconditions *storage.Preconditions,
	tryUpdate storage.UpdateFunc,
	cachedExistingObject runtime.Object,
) error {
	var err error
	for attempt := 1; attempt <= MaxUpdateAttempts; attempt = attempt + 1 {
		err = s.guaranteedUpdate(ctx, key, destination, ignoreNotFound, preconditions, tryUpdate, cachedExistingObject)
		if err == nil {
			return nil
		}
	}

	return err
}

func (s *Storage) guaranteedUpdate(
	ctx context.Context,
	key string,
	destination runtime.Object,
	ignoreNotFound bool,
	preconditions *storage.Preconditions,
	tryUpdate storage.UpdateFunc,
	cachedExistingObject runtime.Object,
) error {
	requestInfo, ok := request.RequestInfoFrom(ctx)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("could not get request info"))
	}

	err := s.Get(ctx, key, storage.GetOptions{}, destination)
	if err != nil {
		return err
	}

	accessor, err := meta.Accessor(destination)
	if err != nil {
		return err
	}
	previousVersion, _ := strconv.ParseInt(accessor.GetResourceVersion(), 10, 64)
	if preconditions != nil && preconditions.ResourceVersion != nil {
		previousVersion, _ = strconv.ParseInt(*preconditions.ResourceVersion, 10, 64)
	}

	res := &storage.ResponseMeta{}
	updatedObj, _, err := tryUpdate(destination, *res)
	if err != nil {
		var statusErr *apierrors.StatusError
		if errors.As(err, &statusErr) {
			// For now, forbidden may come from a mutation handler
			if statusErr.ErrStatus.Reason == metav1.StatusReasonForbidden {
				return statusErr
			}
		}

		return apierrors.NewInternalError(fmt.Errorf("could not successfully update object. key=%s, err=%s", key, err.Error()))
	}

	e, err := resourceToEntity(key, updatedObj, requestInfo, s.codec)
	if err != nil {
		return err
	}

	req := &entityStore.UpdateEntityRequest{
		Entity:          e,
		PreviousVersion: previousVersion,
	}

	rsp, err := s.store.Update(ctx, req)
	if err != nil {
		return err // continue???
	}

	if rsp.Status == entityStore.UpdateEntityResponse_UNCHANGED {
		return nil // destination is already set
	}

	err = entityToResource(rsp.Entity, destination, s.codec)
	if err != nil {
		return apierrors.NewInternalError(err)
	}

	/*
		s.watchSet.notifyWatchers(watch.Event{
			Object: destination.DeepCopyObject(),
			Type:   watch.Modified,
		})
	*/

	return nil
}

// Count returns number of different entries under the key (generally being path prefix).
func (s *Storage) Count(key string) (int64, error) {
	return 0, nil
}

func (s *Storage) Versioner() storage.Versioner {
	return &storage.APIObjectVersioner{}
}

func (s *Storage) RequestWatchProgress(ctx context.Context) error {
	return nil
}
