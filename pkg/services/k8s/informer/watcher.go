package informer

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"reflect"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/k8s/crd"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/rest"
	"k8s.io/utils/strings/slices"
)

// ResourceWatcher describes an object which handles Add/Update/Delete actions for a resource
type ResourceWatcher interface {
	Add(context.Context, any) error
	Update(ctx context.Context, old, new any) error
	Delete(context.Context, any) error
}

// Watcher is a ResourceWatcher implementation that handles extra state logic,
// ensuring that downtime and restarts will not result in missed events.
// It does this via a few mechanisms is transparently handles for the user:
//
// It adds a finalizer for all newly-created resources.
// This ensures that deletes cannot complete until the finalizer is removed,
// so the event will not be missed if the operator is down.
//
// It only removes the finalizer after a successful call to `DeleteFunc`,
// which ensures that the resource is only deleted once the handler has succeeded.
//
// On startup, it is able to differentiate between `Add` events,
// which are newly-created resources the operator has not yet handled,
// and `Add` events which are previously-created resources that have already been handled by the operator.
// Fully new resources call the `AddFunc` handler,
// and previously-created call the `SyncFunc` handler.
//
// `Update` events which do not update anything in the spec or significant parts of the metadata are ignored.
//
// Watcher contains an unexported kubernetes rest client, and must be created with NewWatcher
type Watcher struct {
	AddFunc    func(ctx context.Context, object any) error
	UpdateFunc func(ctx context.Context, old, new any) error
	DeleteFunc func(ctx context.Context, object any) error
	SyncFunc   func(ctx context.Context, object any) error
	finalizer  string
	crd        crd.Kind
	client     dynamic.ResourceInterface
}

// NewWatcherWithClient sets up a new Watcher using an existing client.
// Be sure that the client can handle the resource it's being set up for.
func NewWatcherWithClient(cli dynamic.ResourceInterface, crd crd.Kind) (*Watcher, error) {
	if cli == nil {
		return nil, fmt.Errorf("resource client cannot be nil")
	}
	return &Watcher{
		client:    cli,
		crd:       crd,
		finalizer: fmt.Sprintf("operator.%s", crd.GVK().GroupVersion().Identifier()),
	}, nil
}

// Wrap wraps the Add, Update, and Delete calls in another ResourceWatcher by having the AddFunc call watcher.
// Add, UpdateFunc call watcher.Update, and DeleteFunc call watcher.Delete.
// If syncToAdd is true, SyncFunc will also call resource.Add. If it is false, SyncFunc will not be assigned.
func (o *Watcher) Wrap(watcher ResourceWatcher, syncToAdd bool) { // nolint: revive
	if watcher == nil {
		return
	}

	o.AddFunc = watcher.Add
	o.UpdateFunc = watcher.Update
	o.DeleteFunc = watcher.Delete
	if syncToAdd {
		o.SyncFunc = watcher.Add
	}
}

func (o *Watcher) Add(ctx context.Context, object any) error {
	obj, ok := object.(runtime.Object)
	if !ok {
		return fmt.Errorf("object is not a runtime.Object")
	}
	return o.doAdd(ctx, obj)
}

func (o *Watcher) Update(ctx context.Context, oldObj, newObj any) error {
	oldRuntime, ok := oldObj.(runtime.Object)
	if !ok {
		return fmt.Errorf("oldObj is not a runtime.Object")
	}
	newRuntime, ok := newObj.(runtime.Object)
	if !ok {
		return fmt.Errorf("oldObj is not a runtime.Object")
	}
	return o.doUpdate(ctx, oldRuntime, newRuntime)
}

func (o *Watcher) Delete(ctx context.Context, object any) error {
	obj, ok := object.(runtime.Object)
	if !ok {
		return fmt.Errorf("object is not a runtime.Object")
	}
	return o.doDelete(ctx, obj)
}

// Add is part of implementing ResourceWatcher,
// and calls the underlying AddFunc, SyncFunc, or DeleteFunc based upon internal logic.
// When the object is first added, AddFunc is called and a finalizer is attached to it.
// Subsequent calls to Add will check the finalizer list and call SyncFunc if the finalizer is already attached,
// or if metadata.DeletionTimestamp is non-nil, they will call DeleteFunc and remove the finalizer
// (the finalizer prevents the resource from being hard deleted until it is removed).
func (o *Watcher) doAdd(ctx context.Context, object runtime.Object) error {
	if object == nil {
		return fmt.Errorf("object cannot be nil")
	}

	metadata, err := getMetadata(object)
	if err != nil {
		return err
	}

	// If we don't have the metadata we're looking for, we can't do our opinionated behavior.
	// Give up and just call the add handler
	if metadata.Name == "" {
		return o.addFunc(ctx, object)
	}

	// Check if this resource has a DeletionTimestamp.
	// If it does, it's been deleted, and is only sticking around because of finalizers
	if metadata.DeletionTimestamp != nil {
		// Check if we're the finalizer it's waiting for. If we're not, we can drop this whole event.
		if !slices.Contains(metadata.Finalizers, o.finalizer) {
			return nil
		}

		// Otherwise, we need to run our delete handler, then remove the finalizer
		err = o.deleteFunc(ctx, object)
		if err != nil {
			return err
		}

		// The remove finalizer code is shared by both our add and update handlers, as this logic can be hit from either
		return o.removeFinalizer(ctx, &metadata)
	}

	// Next, we need to check if our finalizer is already in the finalizer list.
	// If it is, we've already done the add logic on a previous run of the operator,
	// and this event is due to the list call on startup. In that case, we call our sync handler
	if slices.Contains(metadata.Finalizers, o.finalizer) {
		return o.syncFunc(ctx, object)
	}

	// If this isn't a delete or an add we've seen before, then it's a new resource we need to handle appropriately.
	// Call the add handler, and if it returns successfully (no error), add the finalizer
	err = o.addFunc(ctx, object)
	if err != nil {
		return err
	}

	// Add the finalizer
	err = o.addFinalizer(ctx, &metadata)
	if err != nil {
		return fmt.Errorf("error adding finalizer: %w", err)
	}
	return nil
}

// Update is part of implementing ResourceWatcher
// and calls the underlying UpdateFunc or DeleteFunc based on internal logic.
// If the new object has a non-nil metadata.DeletionTimestamp in its metadata, DeleteFunc will be called,
// and the object's finalizer will be removed to allow kubernetes to hard delete it.
// Otherwise, UpdateFunc is called, provided the update is non-trivial (that is, the metadata.Generation has changed).
func (o *Watcher) doUpdate(ctx context.Context, old runtime.Object, new runtime.Object) error {
	// TODO: If old is nil, it _might_ be ok?
	if old == nil {
		return fmt.Errorf("old cannot be nil")
	}
	if new == nil {
		return fmt.Errorf("new cannot be nil")
	}

	// Get the metadata for the old and new objects
	oldMeta, err := getMetadata(old)
	if err != nil {
		return err
	}
	newMeta, err := getMetadata(new)
	if err != nil {
		return err
	}

	// Compare generations.
	// If the generation is the same, then nothing we care about has changed and we can ignore this event.
	if oldMeta.Generation == newMeta.Generation {
		return nil
	}

	// Check if the deletion timestamp is non-nil.
	// This denotes that the resource was deletes, but has one or more finalizers blocking it from actually deleting.
	if newMeta.DeletionTimestamp != nil {
		// If our finalizer is in the list, treat this as a delete.
		// Otherwise, drop the event and don't handle it as an update.
		if !slices.Contains(newMeta.Finalizers, o.finalizer) {
			return nil
		}

		// Call the delete handler, then remove the finalizer on success
		err = o.deleteFunc(ctx, new)
		if err != nil {
			return err
		}

		return o.removeFinalizer(ctx, &newMeta)
	}

	// Check if this was us adding our finalizer. If it was, we can ignore it.
	if !slices.Contains(oldMeta.Finalizers, o.finalizer) && slices.Contains(newMeta.Finalizers, o.finalizer) {
		return nil
	}

	return o.updateFunc(ctx, old, new)
}

// Delete exists to implement ResourceWatcher,
// but, due to deletes only happening after the finalizer is removed, this function does nothing.
func (*Watcher) doDelete(context.Context, runtime.Object) error {
	// Do nothing here, because we add finalizers, so we actually call delete code on updates/add-sync
	return nil
}

// addFunc is a wrapper for AddFunc which makes a nil check to avoid panics
func (o *Watcher) addFunc(ctx context.Context, object runtime.Object) error {
	if o.AddFunc != nil {
		return o.AddFunc(ctx, object)
	}
	// TODO: log?
	return nil
}

// updateFunc is a wrapper for UpdateFunc which makes a nil check to avoid panics
func (o *Watcher) updateFunc(ctx context.Context, old, new runtime.Object) error {
	if o.UpdateFunc != nil {
		return o.UpdateFunc(ctx, old, new)
	}
	// TODO: log?
	return nil
}

// deleteFunc is a wrapper for DeleteFunc which makes a nil check to avoid panics
func (o *Watcher) deleteFunc(ctx context.Context, object runtime.Object) error {
	if o.DeleteFunc != nil {
		return o.DeleteFunc(ctx, object)
	}
	// TODO: log?
	return nil
}

// syncFunc is a wrapper for SyncFunc which makes a nil check to avoid panics
func (o *Watcher) syncFunc(ctx context.Context, object runtime.Object) error {
	if o.SyncFunc != nil {
		return o.SyncFunc(ctx, object)
	}
	// TODO: log?
	return nil
}

// removeFinalizer uses a JSON patch to remove the watcher's finalizer from the metadata of the object
func (o *Watcher) removeFinalizer(ctx context.Context, metadata *kubeMetadata) error {
	if metadata == nil {
		return fmt.Errorf("metadata cannot be nil")
	}

	if !slices.Contains(metadata.Finalizers, o.finalizer) {
		// No finalizers managed by this watcher
		return nil
	}

	patch := []map[string]any{{
		"op":   "remove",
		"path": fmt.Sprintf("/metadata/finalizers/%d", slices.Index(metadata.Finalizers, o.finalizer)),
	}}
	b, err := json.Marshal(patch)
	if err != nil {
		return err
	}

	_, err = o.client.Patch(ctx, metadata.Name, types.JSONPatchType, b, metav1.PatchOptions{})
	// TODO: use requestWithBackoffRetry
	return err
}

// addFinalizer uses a JSON Patch request to add the watcher's finalizer to the metadata of the object
func (o *Watcher) addFinalizer(ctx context.Context, metadata *kubeMetadata) error {
	if metadata == nil {
		return fmt.Errorf("metadata cannot be nil")
	}

	if slices.Contains(metadata.Finalizers, o.finalizer) {
		// Finalizer already added
		return nil
	}

	patch := []map[string]any{{
		"op":    "add",
		"path":  "/metadata/finalizers",
		"value": []string{o.finalizer},
	}}
	b, err := json.Marshal(patch)
	if err != nil {
		return err
	}

	_, err = o.client.Patch(ctx, metadata.Name, types.JSONPatchType, b, metav1.PatchOptions{})
	// TODO: use requestWithBackoffRetry
	return err
}

// requestWithBackoffRetry issues a request and will retry up to maxRetries times,
// with an exponential backoff on 5xx or 429 responses
// TODO: update this to support ResourceInterface
func requestWithBackoffRetry(ctx context.Context, request *rest.Request, maxRetries int) rest.Result {
	status := 0
	requestCount := 0
	res := request.Do(ctx).StatusCode(&status)

	// Retry on either 429 or any 5xx error
	for (status == http.StatusTooManyRequests || status >= http.StatusInternalServerError) && requestCount < maxRetries {
		requestCount++

		// Wait backoff + some random jitter
		backoff := time.Duration(int(math.Pow(float64(requestCount), 2))) * time.Second
		jitter := time.Duration(rand.Intn(100)) * time.Millisecond // nolint: gosec
		time.Sleep(backoff + jitter)

		res = request.Do(ctx).StatusCode(&status)
	}

	return res
}

// kubeMetadata is just the metadata of a kubernetes object
type kubeMetadata struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
}

// DeepCopyObject is implemented so that kubeMetadata implements runtime.Object
func (m *kubeMetadata) DeepCopyObject() runtime.Object {
	return crd.DeepCopyObject(m)
}

// getMetadata attempts to use reflection to get the metadata out of the object parameter,
// resorting to using a JSON marshal/unmarshal method if that fails
// TODO: benchmark to see if reflection buys us significant gains, JSON is simpler and safer...
func getMetadata(object runtime.Object) (kubeMetadata, error) {
	metadata := kubeMetadata{}

	// Try to get the "metadata" JSON key and cast it into metav1.ObjectMeta
	rv := reflect.ValueOf(object)
	possMeta := findByJSONTag(rv, "metadata", true, nil)
	if possMeta == nil {
		// Nothing in the object with the JSON key `metadata`, we can't continue
		return metadata, fmt.Errorf("no metadata in object")
	}
	md := *possMeta
	for md.Kind() == reflect.Pointer {
		md = md.Elem()
	}
	objectMeta, ok := md.Interface().(metav1.ObjectMeta)
	if !ok {
		// Well, we tried. Fall back to the JSON marshal/unmarshal method
		return getMetadataJSON(object)
	}
	metadata.ObjectMeta = objectMeta
	return metadata, nil
}

// getMetadataJSON extracts the metadata from a runtime.Object by marshaling it to JSON,
// then attempting to unmarshal it back into a kubeMetadata struct.
func getMetadataJSON(object runtime.Object) (kubeMetadata, error) {
	// Marshal the object into JSON, then back from JSON into a metadata object.
	// So long as the underlying type being watched has the `metadata` key with the metav1.ObjectMetadata properties,
	// this will work.
	bytes, err := json.Marshal(object)
	if err != nil {
		return kubeMetadata{}, err
	}
	metadata := kubeMetadata{}
	err = json.Unmarshal(bytes, &metadata)
	return metadata, err
}

// findByJSONTag returns, if it exists, the struct field value that is tagged with the provided JSON tag.
// If `onlyTopLevel` is true, the field will only be returned,
// _provided_ that it exists in what would be the "top level" of the JSON object.
// That is, it will only look at the passed value's fields,
// _and_ the fields of any "embedded"/"promoted" (reflect calls them "anonymous") structs.
// nolint: revive
func findByJSONTag(
	v reflect.Value, tag string, onlyTopLevel bool, encounteredTypes map[string]struct{},
) *reflect.Value {
	// While the go compiler forbids recursion in "embedded"/"promoted"/"anonymous" structs,
	// it doesn't forbid it if they're pointers, so we still need to make sure we don't infinitely recurse
	if encounteredTypes == nil {
		encounteredTypes = make(map[string]struct{})
	}
	for v.Kind() == reflect.Pointer {
		v = v.Elem()
	}
	t := v.Type()
	if _, ok := encounteredTypes[t.Name()]; ok {
		// In a cycle, break out
		return nil
	}
	encounteredTypes[t.Name()] = struct{}{}
	for i := 0; i < v.NumField(); i++ {
		tf := t.Field(i)
		if !tf.IsExported() {
			continue // Panic if we try to return/expose unexported fields
		}
		// If the JSON tag matches what we're looking for, return
		if parts := strings.Split(tf.Tag.Get("json"), ","); len(parts) > 0 && parts[0] == tag {
			field := v.Field(i)
			return &field
		}

		// This field isn't anonymous, we can skip it, because we don't need to go into it if it's a struct
		if onlyTopLevel && !tf.Anonymous {
			continue
		}

		// If the field is a struct, recursively call this function to check its fields
		vf := v.Field(i)
		for vf.Kind() == reflect.Pointer {
			vf = vf.Elem()
		}
		if vf.Kind() == reflect.Struct {
			poss := findByJSONTag(vf, tag, onlyTopLevel, encounteredTypes)
			if poss != nil {
				return poss
			}
		}
	}
	return nil
}
