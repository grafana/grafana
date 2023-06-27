package apiserver

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	"github.com/grafana/grafana-apiserver/pkg/apihelpers"
	grafanaApiServerKinds "github.com/grafana/grafana-apiserver/pkg/apis/kinds"
	kindsv1 "github.com/grafana/grafana-apiserver/pkg/apis/kinds/v1"
	"github.com/grafana/kindsys"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/storage/storagebackend/factory"
	"k8s.io/client-go/tools/cache"

	"github.com/grafana/grafana/pkg/kinds"
	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/grafana/grafana/pkg/util"
)

var _ storage.Interface = (*entityStorage)(nil)

const MaxUpdateAttempts = 30

// Storage implements storage.Interface and storage resources as JSON files on disk.
type entityStorage struct {
	dualWrite    DualWriter
	store        entity.EntityStoreServer
	kind         kindsys.Core
	gr           schema.GroupResource
	codec        runtime.Codec
	keyFunc      func(obj runtime.Object) (string, error)
	newFunc      func() runtime.Object
	newListFunc  func() runtime.Object
	getAttrsFunc storage.AttrFunc
	trigger      storage.IndexerFuncs
	indexers     *cache.Indexers
	watchSet     *WatchSet
}

// ErrFileNotExists means the file doesn't actually exist.
var ErrFileNotExists = fmt.Errorf("file doesn't exist")

// ErrNamespaceNotExists means the directory for the namespace doesn't actually exist.
var ErrNamespaceNotExists = errors.New("namespace does not exist")

// NewStorage instantiates a new Storage.
func NewEntityStorage(
	dualWriter DualWriter,
	kind kindsys.Core,
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
	return &entityStorage{
			dualWrite:    dualWriter,
			store:        entity.WireCircularDependencyHack,
			kind:         kind,
			gr:           config.GroupResource,
			codec:        config.Codec,
			keyFunc:      keyFunc,
			newFunc:      newFunc,
			newListFunc:  newListFunc,
			getAttrsFunc: getAttrsFunc,
			trigger:      trigger,
			indexers:     indexers,
			watchSet:     ws,
		}, func() {
			ws.cleanupWatchers()
		}, nil
}

// Returns Versioner associated with this storage.
func (s *entityStorage) Versioner() storage.Versioner {
	return &storage.APIObjectVersioner{}
}

func (s *entityStorage) exists(ctx context.Context, grn *entity.GRN) bool {
	rsp, _ := s.store.Read(ctx, &entity.ReadEntityRequest{
		GRN:        grn,
		WithMeta:   false,
		WithStatus: false,
		WithBody:   false,
	})
	return rsp == nil || rsp.Guid == ""
}

func (s *entityStorage) write(ctx context.Context, grn *entity.GRN, uObj *unstructured.Unstructured) (*entity.WriteEntityResponse, error) {
	ctx, err := contextWithFakeGrafanaUser(ctx)
	if err != nil {
		return nil, err
	}

	ok := true
	req := &entity.WriteEntityRequest{
		GRN: grn,
	}
	anno := uObj.GetAnnotations()
	req.Comment, ok = anno[kinds.AnnotationKeyCommitMessage]
	if ok {
		delete(anno, kinds.AnnotationKeyCommitMessage)
		uObj.SetAnnotations(anno)
	}

	spec, ok := uObj.Object["spec"]
	if ok {
		req.Body, err = json.Marshal(spec)
		if err != nil {
			return nil, err
		}
	}
	status, ok := uObj.Object["status"]
	if ok {
		req.Status, err = json.Marshal(status)
		if err != nil {
			return nil, err
		}
	}
	meta, ok := uObj.Object["metadata"]
	if ok {
		req.Meta, err = json.Marshal(meta)
		if err != nil {
			return nil, err
		}
	}

	return s.store.Write(ctx, req)
}

func getItems(listObj runtime.Object) ([]runtime.Object, error) {
	out := make([]runtime.Object, 0)

	switch list := listObj.(type) {
	case *kindsv1.GrafanaKindList:
	case *grafanaApiServerKinds.GrafanaKindList:
	case *unstructured.UnstructuredList:
		for _, item := range list.Items {
			out = append(out, item.DeepCopyObject())
		}
	default:
		return nil, fmt.Errorf("unsupported type %T", listObj)
	}

	return out, nil
}

// Create adds a new object at a key unless it already exists. 'ttl' is time-to-live
// in seconds (0 means forever). If no error is returned and out is not nil, out will be
// set to the read value from database.
func (s *entityStorage) Create(ctx context.Context, key string, obj runtime.Object, out runtime.Object, ttl uint64) error {
	grn, err := keyToGRN(key, &s.gr)
	if err != nil {
		return err
	}

	if err := s.Versioner().PrepareObjectForStorage(obj); err != nil {
		return err
	}

	uObj, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return fmt.Errorf("failed to convert to *unstructured.Unstructured")
	}

	// Replace the default name generation strategy
	if uObj.GetGenerateName() != "" {
		old := grn.UID
		grn.UID = util.GenerateShortUID()
		uObj.SetName(grn.UID)
		uObj.SetGenerateName("")
		key = strings.ReplaceAll(key, old, grn.UID)
	}

	uObj, err = s.dualWrite.Create(uObj)
	if err != nil {
		return err
	}

	rsp, err := s.write(ctx, grn, uObj)
	if err != nil {
		return err
	}
	if rsp.Status != entity.WriteEntityResponse_CREATED {
		return fmt.Errorf("this was not a create operation... (%s)", rsp.Status.String())
	}

	err = s.Get(ctx, key, storage.GetOptions{}, out)
	if err == nil {
		s.watchSet.notifyWatchers(watch.Event{
			Object: out.DeepCopyObject(),
			Type:   watch.Added,
		})
	}
	return err
}

// Delete removes the specified key and returns the value that existed at that spot.
// If key didn't exist, it will return NotFound storage error.
// If 'cachedExistingObject' is non-nil, it can be used as a suggestion about the
// current version of the object to avoid read operation from storage to get it.
// However, the implementations have to retry in case suggestion is stale.
func (s *entityStorage) Delete(
	ctx context.Context, key string, out runtime.Object, preconditions *storage.Preconditions,
	validateDeletion storage.ValidateObjectFunc, cachedExistingObject runtime.Object) error {
	ctx, err := contextWithFakeGrafanaUser(ctx)
	if err != nil {
		return err
	}
	grn, err := keyToGRN(key, &s.gr)
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

	err = s.dualWrite.Delete("namespace", "name") // TODO
	if err != nil {
		return err
	}

	rsp, err := s.store.Delete(ctx, &entity.DeleteEntityRequest{
		GRN: grn,
	})
	if err == nil {
		if !rsp.OK {
			return fmt.Errorf("did not delete")
		}

		s.watchSet.notifyWatchers(watch.Event{
			Object: out.DeepCopyObject(),
			Type:   watch.Deleted,
		})
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
	p := opts.Predicate
	jw := s.watchSet.newWatch()

	var listObj runtime.Object

	switch s.gr.Group {
	// NOTE: this first case is currently not active as we are delegating GRD storage to filepath implementation
	case grafanaApiServerKinds.GroupName:
		listObj = &grafanaApiServerKinds.GrafanaKindList{}
		break
	default:
		listObj = &unstructured.UnstructuredList{}
	}

	err := s.GetList(ctx, key, opts, listObj)
	if err != nil {
		return nil, err
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

// Get unmarshals object found at key into objPtr. On a not found error, will either
// return a zero object of the requested type, or an error, depending on 'opts.ignoreNotFound'.
// Treats empty responses and nil response nodes exactly like a not found error.
// The returned contents may be delayed, but it is guaranteed that they will
// match 'opts.ResourceVersion' according 'opts.ResourceVersionMatch'.
func (s *entityStorage) Get(ctx context.Context, key string, opts storage.GetOptions, objPtr runtime.Object) error {
	ctx, err := contextWithFakeGrafanaUser(ctx)
	if err != nil {
		return err
	}
	grn, err := keyToGRN(key, &s.gr)
	if err != nil {
		return err
	}

	// Hacking "status" as sub-resource to pretend to get history
	info, ok := request.RequestInfoFrom(ctx)
	if ok {
		switch info.Subresource {
		case "history":
			rsp, err := s.store.History(ctx, &entity.EntityHistoryRequest{
				GRN: grn,
			})
			if err != nil {
				return err
			}

			i := func(ctx context.Context, apiVersion, acceptHeader string) (stream io.ReadCloser, flush bool, mimeType string, err error) {
				raw, err := json.Marshal(rsp)
				if err != nil {
					return nil, false, "", err
				}
				return io.NopCloser(bytes.NewReader(raw)), false, "application/json", nil
			}

			streamer := objPtr.(*apihelpers.SubresourceStreamer)
			streamer.SetInputStream(i)
			return err
		case "ref":
			rsp, err := s.store.FindReferences(ctx, &entity.ReferenceRequest{
				Kind: grn.Kind,
				Uid:  grn.UID,
			})
			if err != nil {
				return err
			}

			i := func(ctx context.Context, apiVersion, acceptHeader string) (stream io.ReadCloser, flush bool, mimeType string, err error) {
				raw, err := json.Marshal(rsp)
				if err != nil {
					return nil, false, "", err
				}
				return io.NopCloser(bytes.NewReader(raw)), false, "application/json", nil
			}

			streamer := objPtr.(*apihelpers.SubresourceStreamer)
			streamer.SetInputStream(i)
			return err
		case "":
			// this is fine
		default:
		}
	}

	rsp, err := s.store.Read(ctx, &entity.ReadEntityRequest{
		GRN:        grn,
		WithMeta:   true,
		WithBody:   true,
		WithStatus: true,
	})
	if err != nil {
		return err
	}
	if rsp.GRN == nil {
		return apierrors.NewNotFound(s.gr, grn.UID)
	}

	res, err := enityToResource(rsp)
	if err != nil {
		return err
	}
	// HACK???  should be saved with the payload
	res.APIVersion = "core.kinds.grafana.com" + "/" + "v0-alpha" // << hardcoded
	res.Kind = s.kind.Name()

	jjj, _ := json.Marshal(res)
	_, _, err = s.codec.Decode(jjj, nil, objPtr)

	fmt.Printf("k8s GET/GOT:%s (rv:%s)\n", res.Metadata.Name, res.Metadata.ResourceVersion)
	return err
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
	ctx, err := contextWithFakeGrafanaUser(ctx)
	if err != nil {
		return err
	}

	rsp, err := s.store.Search(ctx, &entity.EntitySearchRequest{
		Kind:     []string{strings.TrimSuffix(s.gr.Resource, "s")}, // dashboards >> dashboard
		WithBody: true,
	})
	if err != nil {
		return err
	}

	u := listObj.(*unstructured.UnstructuredList)
	u.SetGroupVersionKind(schema.GroupVersionKind{
		Group:   s.gr.Group,
		Version: "v1", // List version?
		Kind:    s.gr.Resource + "List",
	})
	u.SetResourceVersion(opts.ResourceVersion) // ???

	for _, r := range rsp.Results {
		// convert r to object pointer???
		//fmt.Printf("FOUND:" + r.Slug)

		// uggg... not the same shape
		eee := &entity.Entity{
			GRN:    r.GRN,
			Guid:   r.Guid,
			Meta:   r.Meta,
			Body:   r.Body,
			Status: r.Status,
		}

		res, err := enityToResource(eee)
		if err != nil {
			return err
		}
		res.APIVersion = "core.kinds.grafana.com" + "/" + "v0.0-alpha"
		res.Kind = s.kind.Name()

		out, err := runtime.DefaultUnstructuredConverter.ToUnstructured(&res)
		if err != nil {
			return err
		}

		u.Items = append(u.Items, unstructured.Unstructured{Object: out})
	}

	if rsp.NextPageToken != "" {
		// u.SetContinue(rsp.NextPageToken)
		fmt.Printf("CONTINUE: %s\n", rsp.NextPageToken)
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
	// ctx, err := contextWithFakeGrafanaUser(ctx)
	// if err != nil {
	// 	return err
	// }
	grn, err := keyToGRN(key, &s.gr)
	if err != nil {
		return err
	}

	var res storage.ResponseMeta
	for attempt := 1; attempt <= MaxUpdateAttempts; attempt = attempt + 1 {
		//var objPtr runtime.Object
		err = s.Get(ctx, key, storage.GetOptions{}, destination)
		if err != nil {
			return err
		}

		// MaxAttempts may be useful in case of server timeout but all the rest of errors such as forbidden
		// and unauthorized need not be reattempted, below we are checking against forbidden
		// but I wonder if we should switch it to != metav1.StatusReasonServerTimeout or just do a single attempt really
		updatedObj, _, err := tryUpdate(destination, res)
		if err != nil {
			if statusErr, ok := err.(*apierrors.StatusError); ok {
				// For now, forbidden may come from a mutation handler
				if statusErr.ErrStatus.Reason == metav1.StatusReasonForbidden {
					return statusErr
				}
			}

			// Hard to debug when we keep trying errors!
			if true {
				return err // return the real error
			}

			if attempt == MaxUpdateAttempts {
				return apierrors.NewInternalError(fmt.Errorf("could not successfully update object of type=%s, key=%s", destination.GetObjectKind(), key))
			} else {
				continue
			}
		}

		uObj, ok := updatedObj.(*unstructured.Unstructured)
		if !ok {
			return fmt.Errorf("failed to convert to *unstructured.Unstructured")
		}

		uObj, err = s.dualWrite.Update(uObj)
		if err != nil {
			return err
		}

		rsp, err := s.write(ctx, grn, uObj)
		if err != nil {
			return err // continue???
		}

		if rsp.Status == entity.WriteEntityResponse_UNCHANGED {
			return nil // destination is already set
		}

		// get the thing we just wrote
		err = s.Get(ctx, key, storage.GetOptions{}, destination)
		if err != nil {
			return err
		}

		s.watchSet.notifyWatchers(watch.Event{
			Object: destination.DeepCopyObject(),
			Type:   watch.Modified,
		})
		return nil
	}
	return nil
}

// Count returns number of different entries under the key (generally being path prefix).
func (s *entityStorage) Count(key string) (int64, error) {
	fmt.Printf("Count [%s] %s (zero for now!)\n", s.gr.Resource, key)
	return 0, nil
}
