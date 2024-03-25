// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes-sigs/apiserver-runtime/blob/main/pkg/experimental/storage/filepath/jsonfile_rest.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package file

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"reflect"
	"strings"
	"sync"
	"time"

	"github.com/bwmarrin/snowflake"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	"k8s.io/client-go/tools/cache"
	"k8s.io/klog/v2"
)

const MaxUpdateAttempts = 30

var _ storage.Interface = (*Storage)(nil)

// Replace with: https://github.com/kubernetes/kubernetes/blob/v1.29.0-alpha.3/staging/src/k8s.io/apiserver/pkg/storage/errors.go#L28
// When we upgrade to 1.29
var errResourceVersionSetOnCreate = errors.New("resourceVersion should not be set on objects to be created")

type parsedKey struct {
	group     string
	resource  string
	namespace string
	name      string
}

// Storage implements storage.Interface and storage resources as JSON files on disk.
type Storage struct {
	root           string
	resourcePrefix string
	gr             schema.GroupResource
	codec          runtime.Codec
	keyFunc        func(obj runtime.Object) (string, error)
	newFunc        func() runtime.Object
	newListFunc    func() runtime.Object
	getAttrsFunc   storage.AttrFunc
	trigger        storage.IndexerFuncs
	indexers       *cache.Indexers

	rvGenerationNode *snowflake.Node
	// rvMutex provides synchronization between Get and GetList+Watch+CUD methods
	// with access to resource version generation for the latter group
	rvMutex   sync.RWMutex
	currentRV uint64

	watchSet  *WatchSet
	versioner storage.Versioner
}

// ErrFileNotExists means the file doesn't actually exist.
var ErrFileNotExists = fmt.Errorf("file doesn't exist")

// ErrNamespaceNotExists means the directory for the namespace doesn't actually exist.
var ErrNamespaceNotExists = errors.New("namespace does not exist")

// NewStorage instantiates a new Storage.
func NewStorage(
	config *storagebackend.ConfigForResource,
	resourcePrefix string,
	keyFunc func(obj runtime.Object) (string, error),
	newFunc func() runtime.Object,
	newListFunc func() runtime.Object,
	getAttrsFunc storage.AttrFunc,
	trigger storage.IndexerFuncs,
	indexers *cache.Indexers,
) (storage.Interface, factory.DestroyFunc, error) {
	root := config.Prefix
	if err := ensureDir(root); err != nil {
		return nil, func() {}, fmt.Errorf("could not establish a writable directory at path=%s", root)
	}

	rvGenerationNode, err := snowflake.NewNode(1)
	if err != nil {
		return nil, nil, err
	}

	s := &Storage{
		root:           root,
		resourcePrefix: resourcePrefix,
		gr:             config.GroupResource,
		codec:          config.Codec,
		keyFunc:        keyFunc,
		newFunc:        newFunc,
		newListFunc:    newListFunc,
		getAttrsFunc:   getAttrsFunc,
		trigger:        trigger,
		indexers:       indexers,

		rvGenerationNode: rvGenerationNode,
		watchSet:         NewWatchSet(),

		versioner: &storage.APIObjectVersioner{},
	}

	// Initialize the RV stored in storage
	s.getNewResourceVersion()

	return s, func() {
		s.watchSet.cleanupWatchers()
	}, nil
}

func (s *Storage) getNewResourceVersion() uint64 {
	snowflakeNumber := s.rvGenerationNode.Generate().Int64()
	s.currentRV = uint64(snowflakeNumber)
	return s.currentRV
}

func (s *Storage) getCurrentResourceVersion() uint64 {
	return s.currentRV
}

func (s *Storage) Versioner() storage.Versioner {
	return s.versioner
}

// Create adds a new object at a key unless it already exists. 'ttl' is time-to-live
// in seconds (0 means forever). If no error is returned and out is not nil, out will be
// set to the read value from database.
func (s *Storage) Create(ctx context.Context, key string, obj runtime.Object, out runtime.Object, ttl uint64) error {
	s.rvMutex.Lock()
	defer s.rvMutex.Unlock()

	fpath := s.filePath(key)
	if exists(fpath) {
		return storage.NewKeyExistsError(key, 0)
	}

	dirname := filepath.Dir(fpath)
	if err := ensureDir(dirname); err != nil {
		return err
	}

	generatedRV := s.getNewResourceVersion()

	metaObj, err := meta.Accessor(obj)
	if err != nil {
		return err
	}
	metaObj.SetSelfLink("")
	if metaObj.GetResourceVersion() != "" {
		return errResourceVersionSetOnCreate
	}

	if err := s.versioner.UpdateObject(obj, generatedRV); err != nil {
		return err
	}

	if err := writeFile(s.codec, fpath, obj); err != nil {
		return err
	}

	// set a timer to delete the file after ttl seconds
	if ttl > 0 {
		time.AfterFunc(time.Second*time.Duration(ttl), func() {
			if err := s.Delete(ctx, key, s.newFunc(), &storage.Preconditions{}, func(ctx context.Context, obj runtime.Object) error { return nil }, obj); err != nil {
				panic(err)
			}
		})
	}

	if err := s.Get(ctx, key, storage.GetOptions{}, out); err != nil {
		return err
	}

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
	// TODO: is it gonna be contentious
	// Either way, this should have max attempts logic
	s.rvMutex.Lock()
	defer s.rvMutex.Unlock()

	fpath := s.filePath(key)
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

		if err := s.Get(ctx, key, storage.GetOptions{}, out); err != nil {
			return err
		}

		generatedRV := s.getNewResourceVersion()
		if err := s.versioner.UpdateObject(out, generatedRV); err != nil {
			return err
		}

		if err := deleteFile(fpath); err != nil {
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

	parsedkey, err := s.convertToParsedKey(key, p)
	if err != nil {
		return nil, err
	}

	var namespace *string
	if parsedkey.namespace != "" {
		namespace = &parsedkey.namespace
	}

	if (opts.SendInitialEvents == nil && requestedRV == 0) || (opts.SendInitialEvents != nil && *opts.SendInitialEvents) {
		if err := s.GetList(ctx, key, opts, listObj); err != nil {
			return nil, err
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

	maybeUpdatedRV := requestedRV
	if maybeUpdatedRV == 0 {
		s.rvMutex.RLock()
		maybeUpdatedRV = s.getCurrentResourceVersion()
		s.rvMutex.RUnlock()
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
	// No RV generation locking in single item get since its read from the disk
	fpath := s.filePath(key)

	// Since it's a get, check if the dir exists and return early as needed
	dirname := filepath.Dir(fpath)
	if !exists(dirname) {
		return apierrors.NewNotFound(s.gr, s.nameFromKey(key))
	}

	obj, err := readFile(s.codec, fpath, func() runtime.Object {
		return objPtr
	})
	if err != nil {
		if opts.IgnoreNotFound {
			return runtime.SetZeroValue(objPtr)
		}
		rv, err := s.versioner.ParseResourceVersion(opts.ResourceVersion)
		if err != nil {
			return err
		}
		return storage.NewKeyNotFoundError(key, int64(rv))
	}

	currentVersion, err := s.versioner.ObjectResourceVersion(obj)
	if err != nil {
		return err
	}

	if err = s.validateMinimumResourceVersion(opts.ResourceVersion, currentVersion); err != nil {
		return err
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
	remainingItems := int64(0)

	resourceVersionInt, err := s.versioner.ParseResourceVersion(opts.ResourceVersion)
	if err != nil {
		return err
	}

	// read state protected by mutex
	objs, err := func() ([]runtime.Object, error) {
		s.rvMutex.Lock()
		defer s.rvMutex.Unlock()

		if resourceVersionInt == 0 {
			resourceVersionInt = s.getNewResourceVersion()
		}

		var fpath string
		dirpath := s.dirPath(key)
		// Since it's a get, check if the dir exists and return early as needed
		if !exists(dirpath) {
			// We may have gotten the key targeting an individual item
			dirpath = filepath.Dir(dirpath)
			if !exists(dirpath) {
				// ensure we return empty list in listObj instead of a not found error
				return []runtime.Object{}, nil
			}
			fpath = s.filePath(key)
		}

		var objs []runtime.Object
		if fpath != "" {
			obj, err := readFile(s.codec, fpath, func() runtime.Object {
				return s.newFunc()
			})
			if err == nil {
				objs = append(objs, obj)
			}
		} else {
			var err error
			objs, err = readDirRecursive(s.codec, dirpath, s.newFunc)
			if err != nil {
				return nil, err
			}
		}
		return objs, nil
	}()

	if err != nil {
		return err
	}

	listPtr, err := meta.GetItemsPtr(listObj)
	if err != nil {
		return err
	}
	v, err := conversion.EnforcePtr(listPtr)
	if err != nil {
		return err
	}

	for _, obj := range objs {
		currentVersion, err := s.versioner.ObjectResourceVersion(obj)
		if err != nil {
			return err
		}

		ok, err := opts.Predicate.Matches(obj)
		if err == nil && ok {
			v.Set(reflect.Append(v, reflect.ValueOf(obj).Elem()))

			if err := s.validateMinimumResourceVersion(opts.ResourceVersion, currentVersion); err != nil {
				// Below log left for debug. It's usually not an error condition
				// klog.Infof("failed to assert minimum resource version constraint against list version")
				continue
			}
		}
	}

	if err := s.versioner.UpdateList(listObj, resourceVersionInt, "", &remainingItems); err != nil {
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
	var (
		res         storage.ResponseMeta
		updatedObj  runtime.Object
		objFromDisk runtime.Object
		created     bool
		fpath       = s.filePath(key)
		dirpath     = filepath.Dir(fpath)
	)

	for attempt := 1; attempt <= MaxUpdateAttempts; attempt = attempt + 1 {
		var err error

		if !exists(dirpath) {
			if err := ensureDir(dirpath); err != nil {
				return err
			}
		}

		if !exists(fpath) && !ignoreNotFound {
			return apierrors.NewNotFound(s.gr, s.nameFromKey(key))
		}

		objFromDisk, err = readFile(s.codec, fpath, s.newFunc)
		if err != nil {
			// fallback to new object if the file is not found
			objFromDisk = s.newFunc()
			created = true
		}

		if err := preconditions.Check(key, objFromDisk); err != nil {
			if attempt >= MaxUpdateAttempts {
				return fmt.Errorf("precondition failed: %w", err)
			}
			continue
		}

		updatedObj, _, err = tryUpdate(objFromDisk, res)
		if err != nil {
			if attempt >= MaxUpdateAttempts {
				return err
			}
			continue
		}
		break
	}

	unchanged, err := isUnchanged(s.codec, objFromDisk, updatedObj)
	if err != nil {
		return err
	}

	if unchanged {
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

	s.rvMutex.Lock()
	generatedRV := s.getNewResourceVersion()
	if err != nil {
		s.rvMutex.Unlock()
		return err
	}
	s.rvMutex.Unlock()

	if err := s.versioner.UpdateObject(updatedObj, generatedRV); err != nil {
		return err
	}

	if err := writeFile(s.codec, fpath, updatedObj); err != nil {
		return err
	}

	// TODO: make a helper for this and re-use
	u, err := conversion.EnforcePtr(updatedObj)
	if err != nil {
		return fmt.Errorf("unable to enforce updated object pointer: %w", err)
	}
	d, err := conversion.EnforcePtr(destination)
	if err != nil {
		return fmt.Errorf("unable to enforce destination pointer: %w", err)
	}
	d.Set(u)

	eventType := watch.Modified
	if created {
		eventType = watch.Added
		s.watchSet.notifyWatchers(watch.Event{
			Object: destination.DeepCopyObject(),
			Type:   eventType,
		}, nil)
		return nil
	}

	s.watchSet.notifyWatchers(watch.Event{
		Object: destination.DeepCopyObject(),
		Type:   eventType,
	}, objFromDisk.DeepCopyObject())

	return nil
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

func (s *Storage) nameFromKey(key string) string {
	return strings.Replace(key, s.resourcePrefix+"/", "", 1)
}

// While this is an inefficient way to differentiate the ambiguous keys,
// we only need it for initial namespace calculation in watch
// This helps us with watcher tests that don't always set up requestcontext correctly
func (s *Storage) convertToParsedKey(key string, p storage.SelectionPredicate) (*parsedKey, error) {
	// NOTE: the following supports the watcher tests that run against v1/pods
	// Other than that, there are ambiguities in the key format that only field selector
	// when set to use metadata.name can be used to bring clarity in the 3-segment case

	// Cases handled below:
	// namespace scoped:
	// /<group>/<resource>/[<namespace>]/[<name>]
	// /<group>/<resource>/[<namespace>]
	//
	// cluster scoped:
	// /<group>/<resource>/[<name>]
	// /<group>/<resource>
	parts := strings.SplitN(key, "/", 5)
	if len(parts) < 3 && (len(parts) == 2 && parts[1] != "pods") {
		return nil, fmt.Errorf("invalid key (expecting at least 2 parts): %s", key)
	}

	// beware this empty "" as the first separated part for the rest of the parsing below
	if parts[0] != "" {
		return nil, fmt.Errorf("invalid key (expecting leading slash): %s", key)
	}

	k := &parsedKey{}

	// for v1/pods that tests use, Group is empty
	if len(parts) > 1 && s.gr.Group == "" {
		k.resource = parts[1]
	}

	if len(parts) > 2 {
		// for v1/pods that tests use, Group is empty
		if parts[1] == s.gr.Resource {
			k.resource = parts[1]
			if _, found := p.Field.RequiresExactMatch("metadata.name"); !found {
				k.namespace = parts[2]
			}
		} else {
			k.group = parts[1]
			k.resource = parts[2]
		}
	}

	if len(parts) > 3 {
		// for v1/pods that tests use, Group is empty
		if parts[1] == s.gr.Resource {
			k.name = parts[3]
		} else {
			if _, found := p.Field.RequiresExactMatch("metadata.name"); !found {
				k.namespace = parts[3]
			}
		}
	}

	return k, nil
}
