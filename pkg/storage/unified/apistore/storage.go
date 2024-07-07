package apistore

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"reflect"
	"strconv"
	"sync/atomic"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanaregistry "github.com/grafana/grafana/pkg/apiserver/registry/generic"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

const MaxUpdateAttempts = 30

var _ storage.Interface = (*Storage)(nil)

// Replace with: https://github.com/kubernetes/kubernetes/blob/v1.29.0-alpha.3/staging/src/k8s.io/apiserver/pkg/storage/errors.go#L28
// When we upgrade to 1.29
var errResourceVersionSetOnCreate = errors.New("resourceVersion should not be set on objects to be created")

// Storage implements storage.Interface and storage resources as JSON files on disk.
type Storage struct {
	client       resource.ResourceStoreClient
	gr           schema.GroupResource
	codec        runtime.Codec
	newFunc      func() runtime.Object
	newListFunc  func() runtime.Object
	getAttrsFunc storage.AttrFunc

	currentRV atomic.Int64

	watchSet  *WatchSet
	versioner storage.Versioner
}

// NewStorage instantiates a new Storage.
func NewStorage(
	config *storagebackend.ConfigForResource,
	client resource.ResourceStoreClient,
	newFunc func() runtime.Object,
	newListFunc func() runtime.Object,
	getAttrsFunc storage.AttrFunc,
) (storage.Interface, factory.DestroyFunc, error) {

	s := &Storage{
		client:       client,
		gr:           config.GroupResource,
		codec:        config.Codec,
		newFunc:      newFunc,
		newListFunc:  newListFunc,
		getAttrsFunc: getAttrsFunc,

		watchSet: NewWatchSet(),

		versioner: &storage.APIObjectVersioner{},
	}

	return s, func() {
		s.watchSet.CleanupWatchers()
	}, nil
}

func (s *Storage) getCurrentResourceVersion() uint64 {
	return uint64(s.currentRV.Load())
}

func (s *Storage) Versioner() storage.Versioner {
	return s.versioner
}

func errorWrap(status *resource.StatusResult) error {
	if status != nil {
		return &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    status.Code,
			Reason:  metav1.StatusReason(status.Reason),
			Message: status.Message,
		}}
	}
	return nil
}

func getKey(val string) (*resource.ResourceKey, error) {
	k, err := grafanaregistry.ParseKey(val)
	if err != nil {
		return nil, err
	}
	if k.Group == "" {
		k.Group = "example.apiserver.k8s.io" //return nil, apierrors.NewInternalError(fmt.Errorf("missing group in request"))
	}
	if k.Resource == "" {
		return nil, apierrors.NewInternalError(fmt.Errorf("missing resource in request"))
	}
	return &resource.ResourceKey{
		Namespace: k.Namespace,
		Group:     k.Group,
		Resource:  k.Resource,
		Name:      k.Name,
	}, err
}

// Create adds a new object at a key unless it already exists. 'ttl' is time-to-live
// in seconds (0 means forever). If no error is returned and out is not nil, out will be
// set to the read value from database.
func (s *Storage) Create(ctx context.Context, key string, obj runtime.Object, out runtime.Object, ttl uint64) error {
	k, err := getKey(key)
	if err != nil {
		return err
	}

	err = s.Versioner().PrepareObjectForStorage(obj)
	if err != nil {
		return err
	}

	var buf bytes.Buffer
	err = s.codec.Encode(obj, &buf)
	if err != nil {
		return err
	}

	cmd := &resource.CreateRequest{
		Key:   k,
		Value: buf.Bytes(),
	}

	rsp, err := s.client.Create(ctx, cmd)
	if err != nil {
		return err
	}
	err = errorWrap(rsp.Status)
	if err != nil {
		return err
	}

	if rsp.Status != nil {
		return fmt.Errorf("error in status %+v", rsp.Status)
	}

	// Create into the out value
	_, _, err = s.codec.Decode(rsp.Value, nil, out)
	if err != nil {
		return err
	}
	after, err := utils.MetaAccessor(out)
	if err != nil {
		return err
	}
	after.SetResourceVersionInt64(rsp.ResourceVersion)

	// set a timer to delete the file after ttl seconds
	if ttl > 0 {
		time.AfterFunc(time.Second*time.Duration(ttl), func() {
			if err := s.Delete(ctx, key, s.newFunc(), &storage.Preconditions{}, func(ctx context.Context, obj runtime.Object) error { return nil }, obj); err != nil {
				panic(err)
			}
		})
	}

	fmt.Printf("CREATE %v\n", key)
	s.watchSet.notifyWatchers(watch.Event{
		Object: out.DeepCopyObject(),
		Type:   watch.Added,
	}, nil)

	return nil
}

// Delete removes the specified key and returns the value that existed at that spot.
// If key didn't exist, it will return NotFound storage error.
// If 'cachedExistingObject' is non-nil, it can be used as a suggestion about the
// current version of the object to avoid read operation from storage to get it.
// However, the implementations have to retry in case suggestion is stale.
func (s *Storage) Delete(
	ctx context.Context,
	key string,
	out runtime.Object,
	preconditions *storage.Preconditions,
	validateDeletion storage.ValidateObjectFunc,
	cachedExistingObject runtime.Object,
) error {
	var currentState runtime.Object
	var stateIsCurrent bool
	if cachedExistingObject != nil {
		currentState = cachedExistingObject
	} else {
		getOptions := storage.GetOptions{}
		if preconditions != nil && preconditions.ResourceVersion != nil {
			getOptions.ResourceVersion = *preconditions.ResourceVersion
		}
		if err := s.Get(ctx, key, getOptions, currentState); err == nil {
			stateIsCurrent = true
		}
	}

	for {
		if preconditions != nil {
			if err := preconditions.Check(key, out); err != nil {
				if stateIsCurrent {
					return err
				}

				// If the state is not current, we need to re-read the state and try again.
				if err := s.Get(ctx, key, storage.GetOptions{}, currentState); err != nil {
					return err
				}
				stateIsCurrent = true
				continue
			}
		}

		if err := validateDeletion(ctx, out); err != nil {
			if stateIsCurrent {
				return err
			}

			// If the state is not current, we need to re-read the state and try again.
			if err := s.Get(ctx, key, storage.GetOptions{}, currentState); err == nil {
				stateIsCurrent = true
			}
			continue
		}

		k, err := getKey(key)
		if err != nil {
			return err
		}

		cmd := &resource.DeleteRequest{Key: k}
		if preconditions != nil {
			if preconditions.ResourceVersion != nil {
				cmd.ResourceVersion, err = strconv.ParseInt(*preconditions.ResourceVersion, 10, 64)
				if err != nil {
					return err
				}
			}
			if preconditions.UID != nil {
				cmd.Uid = string(*preconditions.UID)
			}
		}

		rsp, err := s.client.Delete(ctx, cmd)
		if err != nil {
			if apierrors.IsNotFound(err) {
				return storage.NewKeyNotFoundError(key, cmd.ResourceVersion)
			}
			return err
		}
		err = errorWrap(rsp.Status)
		if err != nil {
			return err
		}

		s.watchSet.notifyWatchers(watch.Event{
			Object: out.DeepCopyObject(),
			Type:   watch.Deleted,
		}, nil)

		return nil
	}
}

// Watch begins watching the specified key. Events are decoded into API objects,
// and any items selected by the predicate are sent down to returned watch.Interface.
// resourceVersion may be used to specify what version to begin watching,
// which should be the current resourceVersion, and no longer rv+1
// (e.g. reconnecting without missing any updates).
// If resource version is "0", this interface will get current object at given key
// and send it in an "ADDED" event, before watch starts.
func (s *Storage) Watch(ctx context.Context, key string, opts storage.ListOptions) (watch.Interface, error) {
	p := opts.Predicate
	listObj := s.newListFunc()

	// Parses to 0 for opts.ResourceVersion == 0
	requestedRV, err := s.versioner.ParseResourceVersion(opts.ResourceVersion)
	if err != nil {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("invalid resource version: %v", err))
	}

	parsedkey, err := grafanaregistry.ParseKey(key)
	if err != nil {
		return nil, err
	}

	var namespace *string
	if parsedkey.Namespace != "" {
		namespace = &parsedkey.Namespace
	}

	if (opts.SendInitialEvents == nil && requestedRV == 0) || (opts.SendInitialEvents != nil && *opts.SendInitialEvents) {
		fmt.Printf("DO LIST %v\n", key)
		if err := s.GetList(ctx, key, opts, listObj); err != nil {
			if errors.Is(err, context.Canceled) {
				fmt.Printf("XXX CANCELLED %v\n", key)
			}
			fmt.Printf("ERROR %v\n", err)
			return &dummyWatch{}, nil
		}

		listAccessor, err := meta.ListAccessor(listObj)
		if err != nil {
			klog.Errorf("could not determine new list accessor in watch")
			return nil, err
		}
		// Updated if requesting RV was either "0" or ""
		maybeUpdatedRV, err := s.versioner.ParseResourceVersion(listAccessor.GetResourceVersion())
		if err != nil {
			klog.Errorf("could not determine new list RV in watch")
			return nil, err
		}

		jw := s.watchSet.newWatch(ctx, maybeUpdatedRV, p, s.versioner, namespace)

		initEvents := make([]watch.Event, 0)
		listPtr, err := meta.GetItemsPtr(listObj)
		if err != nil {
			return nil, err
		}
		v, err := conversion.EnforcePtr(listPtr)
		if err != nil || v.Kind() != reflect.Slice {
			return nil, fmt.Errorf("need pointer to slice: %v", err)
		}

		for i := 0; i < v.Len(); i++ {
			obj, ok := v.Index(i).Addr().Interface().(runtime.Object)
			if !ok {
				return nil, fmt.Errorf("need item to be a runtime.Object: %v", err)
			}

			initEvents = append(initEvents, watch.Event{
				Type:   watch.Added,
				Object: obj.DeepCopyObject(),
			})
		}

		if p.AllowWatchBookmarks && len(initEvents) > 0 {
			lastInitEvent := initEvents[len(initEvents)-1]
			lastItemRV, err := s.versioner.ObjectResourceVersion(lastInitEvent.Object)
			if err != nil {
				return nil, fmt.Errorf("could not get last init event's revision for bookmark: %v", err)
			}

			bookmarkEvent := watch.Event{
				Type:   watch.Bookmark,
				Object: s.newFunc(),
			}

			if err := s.versioner.UpdateObject(bookmarkEvent.Object, lastItemRV); err != nil {
				return nil, err
			}

			bookmarkObject, err := meta.Accessor(bookmarkEvent.Object)
			if err != nil {
				return nil, fmt.Errorf("could not get bookmark object's acccesor: %v", err)
			}
			bookmarkObject.SetAnnotations(map[string]string{"k8s.io/initial-events-end": "true"})
			initEvents = append(initEvents, bookmarkEvent)
		}

		jw.Start(initEvents...)
		return jw, nil
	}

	fmt.Printf("WATCH %v\n", key)
	maybeUpdatedRV := requestedRV
	if maybeUpdatedRV == 0 {
		maybeUpdatedRV = s.getCurrentResourceVersion()
	}
	jw := s.watchSet.newWatch(ctx, maybeUpdatedRV, p, s.versioner, namespace)

	jw.Start()
	return jw, nil
}

// Get unmarshals object found at key into objPtr. On a not found error, will either
// return a zero object of the requested type, or an error, depending on 'opts.ignoreNotFound'.
// Treats empty responses and nil response nodes exactly like a not found error.
// The returned contents may be delayed, but it is guaranteed that they will
// match 'opts.ResourceVersion' according 'opts.ResourceVersionMatch'.
func (s *Storage) Get(ctx context.Context, key string, opts storage.GetOptions, objPtr runtime.Object) error {
	var err error
	req := &resource.ReadRequest{}
	req.Key, err = getKey(key)
	if err != nil {
		return err
	}

	if opts.ResourceVersion != "" {
		req.ResourceVersion, err = strconv.ParseInt(opts.ResourceVersion, 10, 64)
		if err != nil {
			return err
		}
	}

	rsp, err := s.client.Read(ctx, req)
	if err != nil {
		return err
	}
	if rsp.Status != nil && rsp.Status.Code == 404 {
		return storage.NewKeyNotFoundError(key, req.ResourceVersion)
	}
	err = errorWrap(rsp.Status)
	if err != nil {
		if opts.IgnoreNotFound {
			return runtime.SetZeroValue(objPtr)
		}
		return err // storage.NewKeyNotFoundError(key, req.ResourceVersion)
	}
	if err = s.validateMinimumResourceVersion(opts.ResourceVersion, uint64(rsp.ResourceVersion)); err != nil {
		return err
	}

	_, _, err = s.codec.Decode(rsp.Value, &schema.GroupVersionKind{}, objPtr)
	if err != nil {
		return err
	}
	obj, err := utils.MetaAccessor(objPtr)
	if err != nil {
		return err
	}
	obj.SetResourceVersionInt64(rsp.ResourceVersion)
	return nil
}

func toListRequest(key string, opts storage.ListOptions) (*resource.ListRequest, storage.SelectionPredicate, error) {
	predicate := opts.Predicate
	k, err := getKey(key)
	if err != nil {
		return nil, predicate, err
	}
	req := &resource.ListRequest{
		Limit: opts.Predicate.Limit,
		Options: &resource.ListOptions{
			Key: k,
		},
		NextPageToken: predicate.Continue,
	}

	if opts.Predicate.Label != nil && !opts.Predicate.Label.Empty() {
		requirements, selectable := opts.Predicate.Label.Requirements()
		if !selectable {
			return nil, predicate, nil // not selectable
		}

		for _, r := range requirements {
			v := r.Key()

			req.Options.Labels = append(req.Options.Labels, &resource.Requirement{
				Key:      v,
				Operator: string(r.Operator()),
				Values:   r.Values().List(),
			})
		}
	}

	if opts.Predicate.Field != nil && !opts.Predicate.Field.Empty() {
		requirements := opts.Predicate.Field.Requirements()
		for _, r := range requirements {
			requirement := &resource.Requirement{Key: r.Field, Operator: string(r.Operator)}
			if r.Value != "" {
				requirement.Values = append(requirement.Values, r.Value)
			}
			req.Options.Labels = append(req.Options.Labels, requirement)
		}
	}

	if opts.ResourceVersion != "" {
		rv, err := strconv.ParseInt(opts.ResourceVersion, 10, 64)
		if err != nil {
			return nil, predicate, apierrors.NewBadRequest(fmt.Sprintf("invalid resource version: %s", opts.ResourceVersion))
		}
		req.ResourceVersion = rv
	}

	switch opts.ResourceVersionMatch {
	case "", metav1.ResourceVersionMatchNotOlderThan:
		req.VersionMatch = resource.ResourceVersionMatch_NotOlderThan
	case metav1.ResourceVersionMatchExact:
		req.VersionMatch = resource.ResourceVersionMatch_Exact
	default:
		return nil, predicate, apierrors.NewBadRequest(
			fmt.Sprintf("unsupported version match: %v", opts.ResourceVersionMatch),
		)
	}

	return req, predicate, nil
}

// GetList unmarshalls objects found at key into a *List api object (an object
// that satisfies runtime.IsList definition).
// If 'opts.Recursive' is false, 'key' is used as an exact match. If `opts.Recursive'
// is true, 'key' is used as a prefix.
// The returned contents may be delayed, but it is guaranteed that they will
// match 'opts.ResourceVersion' according 'opts.ResourceVersionMatch'.
func (s *Storage) GetList(ctx context.Context, key string, opts storage.ListOptions, listObj runtime.Object) error {
	req, predicate, err := toListRequest(key, opts)
	if err != nil {
		return err
	}
	remainingItems := int64(0)

	rsp, err := s.client.List(ctx, req)
	if err != nil {
		return err
	}
	if rsp.ResourceVersion > s.currentRV.Load() {
		s.currentRV.Swap(rsp.ResourceVersion)
	}

	listPtr, err := meta.GetItemsPtr(listObj)
	if err != nil {
		return err
	}
	v, err := conversion.EnforcePtr(listPtr)
	if err != nil {
		return err
	}

	for _, item := range rsp.Items {
		currentVersion := uint64(item.ResourceVersion)

		if opts.SendInitialEvents == nil || (opts.SendInitialEvents != nil && !*opts.SendInitialEvents) {
			// Apply the minimum resource version validation when we are not being called as part of Watch
			// SendInitialEvents flow
			// reason: the resource version of currently returned init items will always be < list RV
			// they are being generated for, unless of course, the requestedRV == "0"/""
			if err := s.validateMinimumResourceVersion(opts.ResourceVersion, currentVersion); err != nil {
				// Below log left for debug. It's usually not an error condition
				// klog.Infof("failed to assert minimum resource version constraint against list version")
				continue
			}
		}

		tmp := s.newFunc()

		tmp, _, err = s.codec.Decode(item.Value, nil, tmp)
		if err != nil {
			return err
		}
		obj, err := utils.MetaAccessor(tmp)
		if err != nil {
			return err
		}
		obj.SetResourceVersionInt64(item.ResourceVersion)

		ok, err := predicate.Matches(tmp)
		if err == nil && ok {
			v.Set(reflect.Append(v, reflect.ValueOf(tmp).Elem()))
		}
	}

	if err := s.versioner.UpdateList(listObj, uint64(rsp.ResourceVersion), "", &remainingItems); err != nil {
		return err
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
func (s *Storage) GuaranteedUpdate(
	ctx context.Context,
	key string,
	destination runtime.Object,
	ignoreNotFound bool,
	preconditions *storage.Preconditions,
	tryUpdate storage.UpdateFunc,
	cachedExistingObject runtime.Object,
) error {
	k, err := getKey(key)
	if err != nil {
		return err
	}
	existingObject := s.newFunc()

	var (
		res        storage.ResponseMeta
		updatedObj runtime.Object
		created    bool
	)

	for attempt := 1; attempt <= MaxUpdateAttempts; attempt = attempt + 1 {
		err = s.Get(ctx, key, storage.GetOptions{}, existingObject)
		if err != nil {
			if ignoreNotFound && apierrors.IsNotFound(err) {
				created = true
			} else {
				return storage.NewKeyNotFoundError(key, 0)
			}
		}

		if err := preconditions.Check(key, existingObject); err != nil {
			if attempt >= MaxUpdateAttempts {
				return fmt.Errorf("precondition failed: %w", err)
			}
			continue
		}

		updatedObj, _, err = tryUpdate(existingObject, res)
		if err != nil {
			if attempt >= MaxUpdateAttempts {
				return err
			}
			continue
		}
		break
	}

	unchanged, err := isUnchanged(s.codec, existingObject, updatedObj)
	if err != nil {
		return err
	}

	if unchanged {
		if err := copyModifiedObjectToDestination(updatedObj, destination); err != nil {
			return err
		}
		return nil
	}

	var buf bytes.Buffer
	err = s.codec.Encode(updatedObj, &buf)
	if err != nil {
		return err
	}

	// Switch to create when existing value does not exist
	var rsp *resource.UpdateResponse
	if created {
		req := &resource.CreateRequest{Key: k, Value: buf.Bytes()}
		upp, err := s.client.Create(ctx, req)
		if err != nil {
			return err
		}
		rsp = &resource.UpdateResponse{
			Value:           upp.Value,
			ResourceVersion: upp.ResourceVersion,
			Status:          upp.Status,
		}
	} else {
		req := &resource.UpdateRequest{Key: k, Value: buf.Bytes()}
		rsp, err = s.client.Update(ctx, req)
		if err != nil {
			return err
		}
	}
	err = errorWrap(rsp.Status)
	if err != nil {
		return err
	}

	// Read the mutated fields the response field
	_, _, err = s.codec.Decode(rsp.Value, nil, destination)
	if err != nil {
		return err
	}
	accessor, err := utils.MetaAccessor(destination)
	if err != nil {
		return err
	}
	accessor.SetResourceVersionInt64(rsp.ResourceVersion)

	// direct watch events...
	{
		if created {
			s.watchSet.notifyWatchers(watch.Event{
				Type:   watch.Added,
				Object: destination.DeepCopyObject(),
			}, nil)
		} else {
			s.watchSet.notifyWatchers(watch.Event{
				Type:   watch.Modified,
				Object: destination.DeepCopyObject(),
			}, existingObject.DeepCopyObject())
		}
	}

	return nil
}

func isUnchanged(codec runtime.Codec, obj runtime.Object, newObj runtime.Object) (bool, error) {
	buf := new(bytes.Buffer)
	if err := codec.Encode(obj, buf); err != nil {
		return false, err
	}

	newBuf := new(bytes.Buffer)
	if err := codec.Encode(newObj, newBuf); err != nil {
		return false, err
	}

	return bytes.Equal(buf.Bytes(), newBuf.Bytes()), nil
}

// Count returns number of different entries under the key (generally being path prefix).
func (s *Storage) Count(key string) (int64, error) {
	return 0, nil
}

// RequestWatchProgress requests the a watch stream progress status be sent in the
// watch response stream as soon as possible.
// Used for monitor watch progress even if watching resources with no changes.
//
// If watch is lagging, progress status might:
// * be pointing to stale resource version. Use etcd KV request to get linearizable resource version.
// * not be delivered at all. It's recommended to poll request progress periodically.
//
// Note: Only watches with matching context grpc metadata will be notified.
// https://github.com/kubernetes/kubernetes/blob/9325a57125e8502941d1b0c7379c4bb80a678d5c/vendor/go.etcd.io/etcd/client/v3/watch.go#L1037-L1042
//
// TODO: Remove when storage.Interface will be separate from etc3.store.
// Deprecated: Added temporarily to simplify exposing RequestProgress for watch cache.
func (s *Storage) RequestWatchProgress(_ context.Context) error {
	return nil
}

// validateMinimumResourceVersion returns a 'too large resource' version error when the provided minimumResourceVersion is
// greater than the most recent actualRevision available from storage.
func (s *Storage) validateMinimumResourceVersion(minimumResourceVersion string, actualRevision uint64) error {
	if minimumResourceVersion == "" {
		return nil
	}
	minimumRV, err := s.versioner.ParseResourceVersion(minimumResourceVersion)
	if err != nil {
		return apierrors.NewBadRequest(fmt.Sprintf("invalid resource version: %v", err))
	}
	// Enforce the storage.Interface guarantee that the resource version of the returned data
	// "will be at least 'resourceVersion'".
	if minimumRV > actualRevision {
		return storage.NewTooLargeResourceVersionError(minimumRV, actualRevision, 0)
	}
	return nil
}

func copyModifiedObjectToDestination(updatedObj runtime.Object, destination runtime.Object) error {
	u, err := conversion.EnforcePtr(updatedObj)
	if err != nil {
		return fmt.Errorf("unable to enforce updated object pointer: %w", err)
	}
	d, err := conversion.EnforcePtr(destination)
	if err != nil {
		return fmt.Errorf("unable to enforce destination pointer: %w", err)
	}
	d.Set(u)
	return nil
}
