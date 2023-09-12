// This file is copied from filepath storage of k8s apiserver (storage.go + util.go)
package grafanaapiserver

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/bwmarrin/snowflake"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana-apiserver/pkg/apis/kinds"
	kindsv1 "github.com/grafana/grafana-apiserver/pkg/apis/kinds/v1"
)

var _ storage.Interface = (*JSONStorage)(nil)

const MaxUpdateAttempts = 30

// JSONStorage implements storage.Interface and storage resources as JSON files on disk.
type JSONStorage struct {
	root         string
	gr           schema.GroupResource
	codec        runtime.Codec
	keyFunc      func(obj runtime.Object) (string, error)
	newFunc      func() runtime.Object
	newListFunc  func() runtime.Object
	getAttrsFunc storage.AttrFunc
	trigger      storage.IndexerFuncs
	indexers     *cache.Indexers

	watchSet *WatchSet
}

// ErrFileNotExists means the file doesn't actually exist.
var ErrFileNotExists = fmt.Errorf("file doesn't exist")

// ErrNamespaceNotExists means the directory for the namespace doesn't actually exist.
var ErrNamespaceNotExists = errors.New("namespace does not exist")

func getResourceVersion() (uint64, error) {
	node, err := snowflake.NewNode(1)
	if err != nil {
		return 0, err
	}

	snowflakeNumber := node.Generate().Int64()
	resourceVersion := uint64(snowflakeNumber)
	return resourceVersion, nil
}

// NewJSONStorage instantiates a new Storage.
func NewJSONStorage(
	config *storagebackend.ConfigForResource,
	resourcePrefix string,
	keyFunc func(obj runtime.Object) (string, error),
	newFunc func() runtime.Object,
	newListFunc func() runtime.Object,
	getAttrsFunc storage.AttrFunc,
	trigger storage.IndexerFuncs,
	indexers *cache.Indexers,
) (storage.Interface, factory.DestroyFunc, error) {
	if err := ensureDir(resourcePrefix); err != nil {
		return nil, func() {}, fmt.Errorf("could not establish a writable directory at path=%s", resourcePrefix)
	}
	ws := NewWatchSet()
	return &JSONStorage{
			root:         resourcePrefix,
			gr:           config.GroupResource,
			codec:        config.Codec,
			keyFunc:      keyFunc,
			newFunc:      newFunc,
			newListFunc:  newListFunc,
			getAttrsFunc: getAttrsFunc,
			trigger:      trigger,
			indexers:     indexers,

			watchSet: ws,
		}, func() {
			ws.cleanupWatchers()
		}, nil
}

// Returns Versioner associated with this storage.
func (s *JSONStorage) Versioner() storage.Versioner {
	return &storage.APIObjectVersioner{}
}

// Create adds a new object at a key unless it already exists. 'ttl' is time-to-live
// in seconds (0 means forever). If no error is returned and out is not nil, out will be
// set to the read value from database.
func (s *JSONStorage) Create(ctx context.Context, key string, obj runtime.Object, out runtime.Object, ttl uint64) error {
	filename := key + ".json"

	if exists(filename) {
		return apierrors.NewAlreadyExists(s.gr, s.nameFromKey(key))
	}

	dirname := filepath.Dir(filename)
	if err := ensureDir(dirname); err != nil {
		return err
	}

	generatedRV, err := getResourceVersion()
	if err != nil {
		return err
	}

	if err := s.Versioner().UpdateObject(obj, generatedRV); err != nil {
		return err
	}

	if err := writeFile(s.codec, filename, obj); err != nil {
		return err
	}

	if err := s.Get(ctx, key, storage.GetOptions{}, out); err != nil {
		return err
	}

	s.watchSet.notifyWatchers(watch.Event{
		Object: out.DeepCopyObject(),
		Type:   watch.Added,
	})

	return nil
}

// Delete removes the specified key and returns the value that existed at that spot.
// If key didn't exist, it will return NotFound storage error.
// If 'cachedExistingObject' is non-nil, it can be used as a suggestion about the
// current version of the object to avoid read operation from storage to get it.
// However, the implementations have to retry in case suggestion is stale.
func (s *JSONStorage) Delete(
	ctx context.Context, key string, out runtime.Object, preconditions *storage.Preconditions,
	validateDeletion storage.ValidateObjectFunc, cachedExistingObject runtime.Object) error {

	filename := key + ".json"
	if !exists(filename) {
		return apierrors.NewNotFound(s.gr, s.nameFromKey(key))
	}

	if err := s.Get(ctx, key, storage.GetOptions{}, out); err != nil {
		return err
	}

	if preconditions != nil {
		if err := preconditions.Check(key, out); err != nil {
			return err
		}
	}

	if err := validateDeletion(ctx, out); err != nil {
		return err
	}

	if err := deleteFile(filename); err != nil {
		return err
	}

	s.watchSet.notifyWatchers(watch.Event{
		Object: out.DeepCopyObject(),
		Type:   watch.Deleted,
	})

	return nil
}

// Watch begins watching the specified key. Events are decoded into API objects,
// and any items selected by 'p' are sent down to returned watch.Interface.
// resourceVersion may be used to specify what version to begin watching,
// which should be the current resourceVersion, and no longer rv+1
// (e.g. reconnecting without missing any updates).
// If resource version is "0", this interface will get current object at given key
// and send it in an "ADDED" event, before watch starts.
func (s *JSONStorage) Watch(ctx context.Context, key string, opts storage.ListOptions) (watch.Interface, error) {
	p := opts.Predicate
	jw := s.watchSet.newWatch()

	var listObj runtime.Object

	switch s.gr.Group {
	case kinds.GroupName:
		listObj = &kinds.GrafanaResourceDefinitionList{}
		break
	default:
		listObj = &unstructured.UnstructuredList{}
	}

	if opts.ResourceVersion == "0" {
		err := s.GetList(ctx, key, opts, listObj)
		if err != nil {
			return nil, err
		}
	}

	items, err := getItems(listObj)
	if err != nil {
		return nil, err
	}

	initEvents := make([]watch.Event, 0)
	for _, obj := range items {
		ok, err := p.Matches(obj)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		initEvents = append(initEvents, watch.Event{
			Type:   watch.Added,
			Object: obj.DeepCopyObject(),
		})
	}
	jw.Start(p, initEvents)
	return jw, nil
}

func getItems(listObj runtime.Object) ([]runtime.Object, error) {
	out := []runtime.Object{}

	switch list := listObj.(type) {
	case *kindsv1.GrafanaResourceDefinitionList:
	case *kinds.GrafanaResourceDefinitionList:
	case *unstructured.UnstructuredList:
		for _, item := range list.Items {
			out = append(out, item.DeepCopyObject())
		}
	default:
		return nil, fmt.Errorf("unsupported type %T", listObj)
	}

	return out, nil
}

// Get unmarshals object found at key into objPtr. On a not found error, will either
// return a zero object of the requested type, or an error, depending on 'opts.ignoreNotFound'.
// Treats empty responses and nil response nodes exactly like a not found error.
// The returned contents may be delayed, but it is guaranteed that they will
// match 'opts.ResourceVersion' according 'opts.ResourceVersionMatch'.
func (s *JSONStorage) Get(ctx context.Context, key string, opts storage.GetOptions, objPtr runtime.Object) error {
	filename := key + ".json"
	if !exists(filename) {
		if opts.IgnoreNotFound {
			return runtime.SetZeroValue(objPtr)
		}
		return apierrors.NewNotFound(s.gr, s.nameFromKey(key))
	}

	obj, err := readFile(s.codec, filename, func() runtime.Object {
		return objPtr
	})
	if err != nil {
		return err
	}

	currentVersion, err := s.Versioner().ObjectResourceVersion(obj)
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
func (s *JSONStorage) GetList(ctx context.Context, key string, opts storage.ListOptions, listObj runtime.Object) error {
	dirs := make([]string, 0)
	if key == s.root {
		namespacesDirEntry, err := os.ReadDir(s.root)
		if err != nil {
			return err
		}
		for _, nDirEntry := range namespacesDirEntry {
			dirs = append(dirs, filepath.Join(s.root, nDirEntry.Name()))
		}
		// This covers the case for cluster-scoped resources
		dirs = append(dirs, s.root)
	} else {
		dirs = append(dirs, key)
	}

	if opts.ResourceVersion != "" {
		resourceVersionInt, err := s.Versioner().ParseResourceVersion(opts.ResourceVersion)
		if err != nil {
			return err
		}
		s.Versioner().UpdateObject(listObj, resourceVersionInt)
	} else {
		// TODO: utilize opts.ResourceVersion in the real implementation
		generatedRV, err := getResourceVersion()
		if err != nil {
			return err
		}
		s.Versioner().UpdateObject(listObj, generatedRV)
	}

	for _, dir := range dirs {
		err := s.getListForDir(dir, listObj, opts)
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *JSONStorage) getListForDir(dir string, listObj runtime.Object, opts storage.ListOptions) error {
	// By suppressing the error check here, we are able to return no resources gracefully for non-existing namespaces
	resources, _ := os.ReadDir(dir)
	for _, resource := range resources {
		if resource.Type() == os.ModeDir {
			continue
		}

		var objPtr runtime.Object
		obj, err := readFile(s.codec, filepath.Join(dir, resource.Name()), func() runtime.Object {
			return objPtr
		})
		if err != nil {
			return err
		}
		currentVersion, err := s.Versioner().ObjectResourceVersion(obj)
		if err != nil {
			return err
		}

		if err = s.validateMinimumResourceVersion(opts.ResourceVersion, currentVersion); err != nil {
			continue
		}

		switch list := listObj.(type) {
		case *kindsv1.GrafanaResourceDefinitionList:
			grdObj, ok := obj.(*kindsv1.GrafanaResourceDefinition)
			if !ok {
				return fmt.Errorf("unable to cast object to *kindsv1.GrafanaResourceDefinition")
			}
			list.Items = append(list.Items, *grdObj)
		case *kinds.GrafanaResourceDefinitionList:
			grdObj, ok := obj.(*kinds.GrafanaResourceDefinition)
			if !ok {
				return fmt.Errorf("unable to cast object to *kinds.GrafanaResourceDefinition")
			}
			list.Items = append(list.Items, *grdObj)

		case *unstructured.UnstructuredList:
			uObj, ok := obj.(*unstructured.Unstructured)
			if !ok {
				return fmt.Errorf("unable to cast object to *unstructured.Unstructured")
			}
			list.Items = append(list.Items, *uObj)
		default:
			return fmt.Errorf("unsupported type %T", obj)
		}
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
func (s *JSONStorage) GuaranteedUpdate(
	ctx context.Context,
	key string,
	destination runtime.Object,
	ignoreNotFound bool,
	preconditions *storage.Preconditions,
	tryUpdate storage.UpdateFunc,
	cachedExistingObject runtime.Object,
) error {
	var res storage.ResponseMeta
	for attempt := 1; attempt <= MaxUpdateAttempts; attempt = attempt + 1 {
		var (
			filename = key + ".json"

			obj     runtime.Object
			err     error
			created bool
		)

		if !exists(filename) && !ignoreNotFound {
			return apierrors.NewNotFound(s.gr, s.nameFromKey(key))
		}

		obj, err = readFile(s.codec, filename, s.newFunc)
		if err != nil {
			// fallback to new object if the file is not found
			obj = s.newFunc()
			created = true
		}

		if err := preconditions.Check(key, obj); err != nil {
			if attempt >= MaxUpdateAttempts {
				return fmt.Errorf("precondition failed: %w", err)
			}
			continue
		}

		updatedObj, _, err := tryUpdate(obj, res)
		if err != nil {
			if attempt >= MaxUpdateAttempts {
				return err
			}
			continue
		}

		unchanged, err := isUnchanged(s.codec, obj, updatedObj)
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

		generatedRV, err := getResourceVersion()
		if err != nil {
			return err
		}
		if err := s.Versioner().UpdateObject(updatedObj, generatedRV); err != nil {
			return err
		}
		if err := writeFile(s.codec, filename, updatedObj); err != nil {
			return err
		}
		eventType := watch.Modified
		if created {
			eventType = watch.Added
		}
		s.watchSet.notifyWatchers(watch.Event{
			Object: updatedObj.DeepCopyObject(),
			Type:   eventType,
		})
	}
	return nil
}

// Count returns number of different entries under the key (generally being path prefix).
func (s *JSONStorage) Count(key string) (int64, error) {
	return 0, nil
}

// validateMinimumResourceVersion returns a 'too large resource' version error when the provided minimumResourceVersion is
// greater than the most recent actualRevision available from storage.
func (s *JSONStorage) validateMinimumResourceVersion(minimumResourceVersion string, actualRevision uint64) error {
	if minimumResourceVersion == "" {
		return nil
	}
	minimumRV, err := s.Versioner().ParseResourceVersion(minimumResourceVersion)
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

func (s *JSONStorage) nameFromKey(key string) string {
	return strings.Replace(key, s.root+"/", "", 1)
}

// objectFilePath returns the file path for the given object.
// The directory path is based on the object's GroupVersionKind and namespace:
// {root}/{Group}/{Version}/{Namespace}/{Kind}/{Name}.json
//
// If the object doesn't have a namespace, the file path is based on the
// object's GroupVersionKind:
// {root}/{Group}/{Version}/{Kind}/{Name}.json
func (s *JSONStorage) objectFilePath(ctx context.Context, obj runtime.Object) (string, error) {
	dir := s.objectDirPath(ctx, obj)
	accessor, err := meta.Accessor(obj)
	if err != nil {
		return "", err
	}
	name := accessor.GetName()

	return filepath.Join(dir, name+".json"), nil
}

// objectDirPath returns the directory path for the given object.
// The directory path is based on the object's GroupVersionKind and namespace:
// {root}/{Group}/{Version}/{Namespace}/{Kind}
//
// If the object doesn't have a namespace, the directory path is based on the
// object's GroupVersionKind:
// {root}/{Group}/{Version}/{Kind}
func (s *JSONStorage) objectDirPath(ctx context.Context, obj runtime.Object) string {
	gvk := obj.GetObjectKind().GroupVersionKind()
	p := filepath.Join(s.root, gvk.Group, gvk.Version)

	if ns, ok := request.NamespaceFrom(ctx); ok {
		p = filepath.Join(p, ns)
	}

	return filepath.Join(p, gvk.Kind)
}

func writeFile(codec runtime.Codec, path string, obj runtime.Object) error {
	buf := new(bytes.Buffer)
	if err := codec.Encode(obj, buf); err != nil {
		return err
	}
	return os.WriteFile(path, buf.Bytes(), 0600)
}

func readFile(codec runtime.Codec, path string, newFunc func() runtime.Object) (runtime.Object, error) {
	content, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return nil, err
	}
	newObj := newFunc()
	decodedObj, _, err := codec.Decode(content, nil, newObj)
	if err != nil {
		return nil, err
	}
	return decodedObj, nil
}

func deleteFile(path string) error {
	return os.Remove(path)
}

func exists(filepath string) bool {
	_, err := os.Stat(filepath)
	return err == nil
}

func ensureDir(dirname string) error {
	if !exists(dirname) {
		return os.MkdirAll(dirname, 0700)
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
