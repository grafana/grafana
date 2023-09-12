package grafanaapiserver

import (
	"bytes"
	"context"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/conversion"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/infra/grn"
)

var _ storage.Interface = (*MemoryStorage)(nil)

type MemoryStorage struct {
	data         map[string][]byte
	kind         string
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

func NewMemoryStorage(
	config *storagebackend.ConfigForResource,
	resourcePrefix string,
	keyFunc func(obj runtime.Object) (string, error),
	newFunc func() runtime.Object,
	newListFunc func() runtime.Object,
	getAttrsFunc storage.AttrFunc,
	trigger storage.IndexerFuncs,
	indexers *cache.Indexers,
) (storage.Interface, factory.DestroyFunc, error) {
	ws := NewWatchSet()
	return &MemoryStorage{
			root:         resourcePrefix,
			data:         map[string][]byte{},
			kind:         newFunc().GetObjectKind().GroupVersionKind().Kind,
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

func (s *MemoryStorage) Versioner() storage.Versioner {
	return &storage.APIObjectVersioner{}
}

func (s *MemoryStorage) Create(ctx context.Context, key string, obj runtime.Object, out runtime.Object, ttl uint64) error {
	grn, err := s.grnFromKey(key)
	if err != nil {
		return err
	}
	if _, ok := s.data[grn.ToGRNString()]; ok {
		return apierrors.NewAlreadyExists(s.gr, s.nameFromKey(key))
	}

	generatedRV, err := getResourceVersion()
	if err != nil {
		return err
	}

	if err := s.Versioner().UpdateObject(obj, generatedRV); err != nil {
		return err
	}

	buf := &bytes.Buffer{}
	if err := s.codec.Encode(obj, buf); err != nil {
		return err
	}
	s.data[grn.ToGRNString()] = buf.Bytes()

	if err := s.Get(ctx, key, storage.GetOptions{}, out); err != nil {
		return err
	}

	s.watchSet.notifyWatchers(watch.Event{
		Object: out.DeepCopyObject(),
		Type:   watch.Added,
	})

	return nil
}

func (s *MemoryStorage) Get(ctx context.Context, key string, opts storage.GetOptions, objPtr runtime.Object) error {
	grn, err := s.grnFromKey(key)
	if err != nil {
		return err
	}
	if _, ok := s.data[grn.ToGRNString()]; !ok {
		if opts.IgnoreNotFound {
			return runtime.SetZeroValue(objPtr)
		}
		return apierrors.NewNotFound(s.gr, s.nameFromKey(key))
	}

	_, _, err = s.codec.Decode(s.data[grn.ToGRNString()], nil, objPtr)
	if err != nil {
		return err
	}

	currentVersion, err := s.Versioner().ObjectResourceVersion(objPtr)
	if err != nil {
		return err
	}

	if err = s.validateMinimumResourceVersion(opts.ResourceVersion, currentVersion); err != nil {
		return err
	}

	return nil
}

func (s *MemoryStorage) Delete(
	ctx context.Context, key string, out runtime.Object, preconditions *storage.Preconditions,
	validateDeletion storage.ValidateObjectFunc, cachedExistingObject runtime.Object) error {

	grn, err := s.grnFromKey(key)
	if err != nil {
		return err
	}
	if _, ok := s.data[grn.ToGRNString()]; !ok {
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

	delete(s.data, grn.ToGRNString())

	s.watchSet.notifyWatchers(watch.Event{
		Object: out.DeepCopyObject(),
		Type:   watch.Deleted,
	})

	return nil
}

func (s *MemoryStorage) Watch(ctx context.Context, key string, opts storage.ListOptions) (watch.Interface, error) {
	p := opts.Predicate
	jw := s.watchSet.newWatch()

	listObj := &unstructured.UnstructuredList{}

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

func (s *MemoryStorage) GetList(ctx context.Context, key string, opts storage.ListOptions, listObj runtime.Object) error {
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

	ns := filepath.Base(key)
	err := s.getListForNamespace(ns, listObj, opts)
	if err != nil {
		return err
	}

	return nil
}

func (s *MemoryStorage) getListForNamespace(ns string, listObj runtime.Object, opts storage.ListOptions) error {
	// By suppressing the error check here, we are able to return no resources gracefully for non-existing namespaces
	for k, v := range s.data {
		grn, err := grn.ParseStr(k)
		if err != nil {
			return err
		}

		// filter by namespace
		if !((grn.TenantID == 0 && ns == "default") || strconv.FormatInt(grn.TenantID, 10) == ns) {
			continue
		}

		objPtr := s.newFunc()
		_, _, err = s.codec.Decode(v, nil, objPtr)
		if err != nil {
			return err
		}
		currentVersion, err := s.Versioner().ObjectResourceVersion(objPtr)
		if err != nil {
			return err
		}

		if err = s.validateMinimumResourceVersion(opts.ResourceVersion, currentVersion); err != nil {
			continue
		}
		uList, ok := listObj.(*unstructured.UnstructuredList)
		if !ok {
			return fmt.Errorf("unsupported list type")
		}
		uObj, ok := objPtr.(*unstructured.Unstructured)
		if !ok {
			return fmt.Errorf("unable to cast object to *unstructured.Unstructured")
		}
		uList.Items = append(uList.Items, *uObj)
	}

	return nil
}

func (s *MemoryStorage) GuaranteedUpdate(
	ctx context.Context,
	key string,
	destination runtime.Object,
	ignoreNotFound bool,
	preconditions *storage.Preconditions,
	tryUpdate storage.UpdateFunc,
	cachedExistingObject runtime.Object,
) error {
	var res storage.ResponseMeta
	grn, err := s.grnFromKey(key)
	if err != nil {
		return err
	}
	for attempt := 1; attempt <= MaxUpdateAttempts; attempt = attempt + 1 {
		var created bool
		if _, ok := s.data[grn.ToGRNString()]; !ok && !ignoreNotFound {
			return apierrors.NewNotFound(s.gr, s.nameFromKey(key))
		}

		obj := s.newFunc()
		_, _, err = s.codec.Decode(s.data[grn.ToGRNString()], nil, obj)
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

		buf := &bytes.Buffer{}
		if err := s.codec.Encode(updatedObj, buf); err != nil {
			return err
		}
		s.data[grn.ToGRNString()] = buf.Bytes()

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

func (s *MemoryStorage) Count(key string) (int64, error) {
	return 0, nil
}

func (s *MemoryStorage) validateMinimumResourceVersion(minimumResourceVersion string, actualRevision uint64) error {
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

func (s *MemoryStorage) nameFromKey(key string) string {
	return strings.Replace(key, s.root+"/", "", 1)
}

func (s *MemoryStorage) grnFromKey(key string) (*grn.GRN, error) {
	name := filepath.Base(key)
	ns := filepath.Base(filepath.Dir(key))
	if ns == "default" { // XXX is there a named constant maybe?
		return &grn.GRN{TenantID: 0, ResourceKind: s.kind, ResourceIdentifier: name}, nil
	}
	id, err := strconv.ParseInt(ns, 10, 64) // is namespace just a number then?
	if err != nil {
		return nil, err
	}
	return &grn.GRN{TenantID: id, ResourceKind: s.kind, ResourceIdentifier: name}, nil
}
