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
)

var _ storage.Interface = (*Storage)(nil)

// Storage implements storage.Interface and stores resources in unified storage
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

	e, err := resourceToEntity(obj, requestInfo, s.codec)
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

	return nil
}

// Delete removes the specified key and returns the value that existed at that spot.
// If key didn't exist, it will return NotFound storage error.
// If 'cachedExistingObject' is non-nil, it can be used as a suggestion about the
// current version of the object to avoid read operation from storage to get it.
// However, the implementations have to retry in case suggestion is stale.
func (s *Storage) Delete(ctx context.Context, key string, out runtime.Object, preconditions *storage.Preconditions, validateDeletion storage.ValidateObjectFunc, cachedExistingObject runtime.Object) error {
	requestInfo, ok := request.RequestInfoFrom(ctx)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("could not get request info"))
	}

	k := &entityStore.Key{
		Group:       requestInfo.APIGroup,
		Resource:    requestInfo.Resource,
		Namespace:   requestInfo.Namespace,
		Name:        requestInfo.Name,
		Subresource: requestInfo.Subresource,
	}

	previousVersion := int64(0)
	if preconditions != nil && preconditions.ResourceVersion != nil {
		previousVersion, _ = strconv.ParseInt(*preconditions.ResourceVersion, 10, 64)
	}

	rsp, err := s.store.Delete(ctx, &entityStore.DeleteEntityRequest{
		Key:             k.String(),
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

// Watch begins watching the specified key. Events are decoded into API objects,
// and any items selected by 'p' are sent down to returned watch.Interface.
// resourceVersion may be used to specify what version to begin watching,
// which should be the current resourceVersion, and no longer rv+1
// (e.g. reconnecting without missing any updates).
// If resource version is "0", this interface will get current object at given key
// and send it in an "ADDED" event, before watch starts.
func (s *Storage) Watch(ctx context.Context, key string, opts storage.ListOptions) (watch.Interface, error) {
	requestInfo, ok := request.RequestInfoFrom(ctx)
	if !ok {
		return nil, apierrors.NewInternalError(fmt.Errorf("could not get request info"))
	}

	k := &entityStore.Key{
		Group:       requestInfo.APIGroup,
		Resource:    requestInfo.Resource,
		Namespace:   requestInfo.Namespace,
		Name:        requestInfo.Name,
		Subresource: requestInfo.Subresource,
	}

	if opts.Predicate.Field != nil {
		// check for metadata.name field selector
		if v, ok := opts.Predicate.Field.RequiresExactMatch("metadata.name"); ok && k.Name == "" {
			// just watch the specific key if we have a name field selector
			k.Name = v
		}

		// check for metadata.namespace field selector
		if v, ok := opts.Predicate.Field.RequiresExactMatch("metadata.namespace"); ok && k.Namespace == "" {
			// just watch the specific namespace if we have a namespace field selector
			k.Namespace = v
		}
	}

	// translate grafana.app/* label selectors into field requirements
	requirements, newSelector, err := ReadLabelSelectors(opts.Predicate.Label)
	if err != nil {
		return nil, err
	}

	// Update the selector to remove the unneeded requirements
	opts.Predicate.Label = newSelector

	// if we got a listHistory label selector, watch the specified resource
	if requirements.ListHistory != "" {
		if k.Name != "" && k.Name != requirements.ListHistory {
			return nil, apierrors.NewBadRequest("name field selector does not match listHistory")
		}
		k.Name = requirements.ListHistory
	}

	req := &entityStore.EntityWatchRequest{
		Action: entityStore.EntityWatchRequest_START,
		Key: []string{
			k.String(),
		},
		Labels:              map[string]string{},
		WithBody:            true,
		WithStatus:          true,
		SendInitialEvents:   false,
		AllowWatchBookmarks: opts.Predicate.AllowWatchBookmarks,
	}

	if opts.ResourceVersion != "" {
		rv, err := strconv.ParseInt(opts.ResourceVersion, 10, 64)
		if err != nil {
			return nil, apierrors.NewBadRequest(fmt.Sprintf("invalid resource version: %s", opts.ResourceVersion))
		}

		req.Since = rv
	}

	if opts.SendInitialEvents == nil && req.Since == 0 {
		req.SendInitialEvents = true
	} else if opts.SendInitialEvents != nil {
		req.SendInitialEvents = *opts.SendInitialEvents
	}

	if requirements.Folder != nil {
		req.Folder = *requirements.Folder
	}

	// translate "equals" label selectors to storage label conditions
	labelRequirements, selectable := opts.Predicate.Label.Requirements()
	if !selectable {
		return nil, apierrors.NewBadRequest("label selector is not selectable")
	}

	for _, r := range labelRequirements {
		if r.Operator() == selection.Equals {
			req.Labels[r.Key()] = r.Values().List()[0]
		}
	}

	client, err := s.store.Watch(ctx)
	if err != nil {
		fmt.Printf("watch failed: %s\n", err)
		return nil, err
	}

	err = client.Send(req)
	if err != nil {
		fmt.Printf("watch send failed: %s\n", err)
		err = client.CloseSend()
		if err != nil {
			fmt.Printf("watch close failed: %s\n", err)
		}
		return watch.NewEmptyWatch(), err
	}

	reporter := apierrors.NewClientErrorReporter(500, "WATCH", "")

	decoder := &Decoder{
		client:  client,
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
	requestInfo, ok := request.RequestInfoFrom(ctx)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("could not get request info"))
	}

	k := &entityStore.Key{
		Group:       requestInfo.APIGroup,
		Resource:    requestInfo.Resource,
		Namespace:   requestInfo.Namespace,
		Name:        requestInfo.Name,
		Subresource: requestInfo.Subresource,
	}

	resourceVersion := int64(0)
	var err error
	if opts.ResourceVersion != "" {
		resourceVersion, err = strconv.ParseInt(opts.ResourceVersion, 10, 64)
		if err != nil {
			return apierrors.NewBadRequest(fmt.Sprintf("invalid resource version: %s", opts.ResourceVersion))
		}
	}

	rsp, err := s.store.Read(ctx, &entityStore.ReadEntityRequest{
		Key:             k.String(),
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

		return apierrors.NewNotFound(s.gr, k.Name)
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
	requestInfo, ok := request.RequestInfoFrom(ctx)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("could not get request info"))
	}

	k := &entityStore.Key{
		Group:       requestInfo.APIGroup,
		Resource:    requestInfo.Resource,
		Namespace:   requestInfo.Namespace,
		Name:        requestInfo.Name,
		Subresource: requestInfo.Subresource,
	}

	listPtr, err := meta.GetItemsPtr(listObj)
	if err != nil {
		return err
	}
	v, err := conversion.EnforcePtr(listPtr)
	if err != nil {
		return err
	}

	// translate grafana.app/* label selectors into field requirements
	requirements, newSelector, err := ReadLabelSelectors(opts.Predicate.Label)
	if err != nil {
		return err
	}

	// Update the selector to remove the unneeded requirements
	opts.Predicate.Label = newSelector

	if requirements.ListHistory != "" {
		k.Name = requirements.ListHistory

		req := &entityStore.EntityHistoryRequest{
			Key:           k.String(),
			WithBody:      true,
			WithStatus:    true,
			NextPageToken: opts.Predicate.Continue,
			Limit:         opts.Predicate.Limit,
			Sort:          requirements.SortBy,
		}

		rsp, err := s.store.History(ctx, req)
		if err != nil {
			return apierrors.NewInternalError(err)
		}

		for _, r := range rsp.Versions {
			res := s.newFunc()

			err := entityToResource(r, res, s.codec)
			if err != nil {
				return apierrors.NewInternalError(err)
			}

			// apply any predicates not handled in storage
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

	req := &entityStore.EntityListRequest{
		Key: []string{
			k.String(),
		},
		WithBody:      true,
		WithStatus:    true,
		NextPageToken: opts.Predicate.Continue,
		Limit:         opts.Predicate.Limit,
		Labels:        map[string]string{},
	}

	if requirements.Folder != nil {
		req.Folder = *requirements.Folder
	}
	if len(requirements.SortBy) > 0 {
		req.Sort = requirements.SortBy
	}
	if requirements.ListDeleted {
		req.Deleted = true
	}

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

		// apply any predicates not handled in storage
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
	requestInfo, ok := request.RequestInfoFrom(ctx)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("could not get request info"))
	}

	k := &entityStore.Key{
		Group:       requestInfo.APIGroup,
		Resource:    requestInfo.Resource,
		Namespace:   requestInfo.Namespace,
		Name:        requestInfo.Name,
		Subresource: requestInfo.Subresource,
	}

	getErr := s.Get(ctx, k.String(), storage.GetOptions{}, destination)
	if getErr != nil {
		if ignoreNotFound && apierrors.IsNotFound(getErr) {
			// destination is already set to zero value
			// we'll create the resource
		} else {
			return getErr
		}
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

		return apierrors.NewInternalError(fmt.Errorf("could not successfully update object. key=%s, err=%s", k.String(), err.Error()))
	}

	e, err := resourceToEntity(updatedObj, requestInfo, s.codec)
	if err != nil {
		return err
	}

	// if we have a non-nil getErr, then we've ignored a not found error
	if getErr != nil {
		// object does not exist, create it
		req := &entityStore.CreateEntityRequest{
			Entity: e,
		}

		rsp, err := s.store.Create(ctx, req)
		if err != nil {
			return err
		}

		err = entityToResource(rsp.Entity, destination, s.codec)
		if err != nil {
			return apierrors.NewInternalError(err)
		}

		return nil
	}

	// update the existing object
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

type Decoder struct {
	client  entityStore.EntityStore_WatchClient
	newFunc func() runtime.Object
	opts    storage.ListOptions
	codec   runtime.Codec
}

func (d *Decoder) Decode() (action watch.EventType, object runtime.Object, err error) {
decode:
	for {
		err := d.client.Context().Err()
		if err != nil {
			fmt.Printf("client: context error: %s\n", err)
			return watch.Error, nil, err
		}

		resp, err := d.client.Recv()
		if errors.Is(err, io.EOF) {
			// fmt.Printf("client: watch is done\n")
			return watch.Error, nil, err
		}

		if grpcStatus.Code(err) == grpcCodes.Canceled {
			// fmt.Printf("client: watch was canceled\n")
			return watch.Error, nil, err
		}

		if err != nil {
			fmt.Printf("client: error receiving result: %s", err)
			return watch.Error, nil, err
		}

		if resp.Entity == nil {
			fmt.Printf("client: received nil entity\n")
			continue decode
		}

		obj := d.newFunc()

		if resp.Entity.Action == entityStore.Entity_BOOKMARK {
			// here k8s expects an empty object with just resource version and k8s.io/initial-events-end annotation
			accessor, err := meta.Accessor(obj)
			if err != nil {
				log.Printf("error getting object accessor: %s", err)
				return watch.Error, nil, err
			}

			accessor.SetResourceVersion(fmt.Sprintf("%d", resp.Entity.ResourceVersion))
			accessor.SetAnnotations(map[string]string{"k8s.io/initial-events-end": "true"})
			return watch.Bookmark, obj, nil
		}

		err = entityToResource(resp.Entity, obj, d.codec)
		if err != nil {
			log.Printf("error decoding entity: %s", err)
			return watch.Error, nil, err
		}

		var watchAction watch.EventType
		switch resp.Entity.Action {
		case entityStore.Entity_CREATED:
			// apply any predicates not handled in storage
			matches, err := d.opts.Predicate.Matches(obj)
			if err != nil {
				log.Printf("error matching object: %s", err)
				return watch.Error, nil, err
			}
			if !matches {
				continue decode
			}

			watchAction = watch.Added
		case entityStore.Entity_UPDATED:
			watchAction = watch.Modified

			// apply any predicates not handled in storage
			matches, err := d.opts.Predicate.Matches(obj)
			if err != nil {
				log.Printf("error matching object: %s", err)
				return watch.Error, nil, err
			}

			// if we have a previous object, check if it matches
			prevMatches := false
			prevObj := d.newFunc()
			if resp.Previous != nil {
				err = entityToResource(resp.Previous, prevObj, d.codec)
				if err != nil {
					log.Printf("error decoding entity: %s", err)
					return watch.Error, nil, err
				}

				// apply any predicates not handled in storage
				prevMatches, err = d.opts.Predicate.Matches(prevObj)
				if err != nil {
					log.Printf("error matching object: %s", err)
					return watch.Error, nil, err
				}
			}

			if !matches {
				if !prevMatches {
					continue decode
				}

				// if the object didn't match, send a Deleted event
				watchAction = watch.Deleted

				// here k8s expects the previous object but with the new resource version
				obj = prevObj

				accessor, err := meta.Accessor(obj)
				if err != nil {
					log.Printf("error getting object accessor: %s", err)
					return watch.Error, nil, err
				}

				accessor.SetResourceVersion(fmt.Sprintf("%d", resp.Entity.ResourceVersion))
			} else if !prevMatches {
				// if the object didn't previously match, send an Added event
				watchAction = watch.Added
			}
		case entityStore.Entity_DELETED:
			watchAction = watch.Deleted

			// if we have a previous object, return that in the deleted event
			if resp.Previous != nil {
				err = entityToResource(resp.Previous, obj, d.codec)
				if err != nil {
					log.Printf("error decoding entity: %s", err)
					return watch.Error, nil, err
				}

				// here k8s expects the previous object but with the new resource version
				accessor, err := meta.Accessor(obj)
				if err != nil {
					log.Printf("error getting object accessor: %s", err)
					return watch.Error, nil, err
				}

				accessor.SetResourceVersion(fmt.Sprintf("%d", resp.Entity.ResourceVersion))
			}

			// apply any predicates not handled in storage
			matches, err := d.opts.Predicate.Matches(obj)
			if err != nil {
				log.Printf("error matching object: %s", err)
				return watch.Error, nil, err
			}
			if !matches {
				continue decode
			}
		default:
			watchAction = watch.Error
		}

		return watchAction, obj, nil
	}
}

func (d *Decoder) Close() {
	// fmt.Printf("client: closing watch stream\n")
	err := d.client.CloseSend()
	if err != nil {
		// fmt.Printf("error closing watch stream: %s", err)
	}
}

var _ watch.Decoder = (*Decoder)(nil)
