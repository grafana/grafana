package advisor

import (
	"context"
	"fmt"
	"math/rand"
	"strconv"
	"sync"
	"time"

	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/apps/advisor/pkg/app/checks"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"
)

// advisorStorage provides a simple storage implementation that doesn't require RESTOptionsGetter
// Now with actual in-memory persistence for testing
type advisorStorage struct {
	resourceInfo   utils.ResourceInfo
	tableConverter rest.TableConvertor

	// In-memory storage with thread safety
	mu    sync.RWMutex
	items map[string]runtime.Object // key is namespace/name
}

var (
	_ rest.Storage              = (*advisorStorage)(nil)
	_ rest.Scoper               = (*advisorStorage)(nil)
	_ rest.TableConvertor       = (*advisorStorage)(nil)
	_ rest.SingularNameProvider = (*advisorStorage)(nil)
	_ rest.Lister               = (*advisorStorage)(nil)
	_ rest.Getter               = (*advisorStorage)(nil)
	_ rest.Creater              = (*advisorStorage)(nil)
	_ rest.Updater              = (*advisorStorage)(nil)
	_ rest.GracefulDeleter      = (*advisorStorage)(nil)
	_ rest.CollectionDeleter    = (*advisorStorage)(nil)
)

func (r *advisorStorage) New() runtime.Object {
	return r.resourceInfo.NewFunc()
}

func (r *advisorStorage) NewList() runtime.Object {
	return r.resourceInfo.NewListFunc()
}

func (r *advisorStorage) NamespaceScoped() bool {
	return true // namespaced resource
}

func (r *advisorStorage) GetSingularName() string {
	return r.resourceInfo.GetSingularName()
}

func (r *advisorStorage) Destroy() {
	// Nothing to clean up
}

// TableConvertor interface
func (r *advisorStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return r.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

// Basic CRUD operations - now with actual storage
func (r *advisorStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	// Get namespace from request context (proper way)
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to get namespace from context: %w", err)
	}

	// Try to get from actual storage first
	key := info.Value + "/" + name

	r.mu.RLock()
	defer r.mu.RUnlock()

	if item, exists := r.items[key]; exists {
		return item.DeepCopyObject(), nil
	}

	// If not found in storage, return a sample object for demonstration
	obj := r.resourceInfo.NewFunc()

	// Set common metadata
	if metaObj, ok := obj.(metav1.Object); ok {
		metaObj.SetName(name)
		metaObj.SetNamespace(info.Value)
	}

	// Set resource-specific sample data
	switch r.resourceInfo.GetSingularName() {
	case "check":
		if check, ok := obj.(*advisorv0alpha1.Check); ok {
			check.Spec = advisorv0alpha1.CheckSpec{
				Data: map[string]string{
					"description": "Sample advisor check (not stored)",
					"type":        "sample",
				},
			}
		}
	case "checktype":
		if checkType, ok := obj.(*advisorv0alpha1.CheckType); ok {
			checkType.Spec = advisorv0alpha1.CheckTypeSpec{
				Name: "Sample Check Type (not stored)",
				Steps: []advisorv0alpha1.CheckTypeStep{
					{
						Title:       "Sample Step",
						Description: "This is a sample check type step",
						StepID:      "sample-step-1",
						Resolution:  "Sample resolution",
					},
				},
			}
		}
	}

	return obj, nil
}

func (r *advisorStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// Get namespace from request context (proper way)
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to get namespace from context: %w", err)
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	// Collect items from storage for this namespace
	var items []runtime.Object
	namespacePrefix := info.Value + "/"
	for key, item := range r.items {
		// Only include items from the requested namespace
		if key != namespacePrefix && len(key) > len(namespacePrefix) && key[:len(namespacePrefix)] == namespacePrefix {
			items = append(items, item.DeepCopyObject())
		}
	}

	// Create the list object and populate it with stored items
	list := r.resourceInfo.NewListFunc()
	switch r.resourceInfo.GetSingularName() {
	case "check":
		if checkList, ok := list.(*advisorv0alpha1.CheckList); ok {
			checkList.Items = make([]advisorv0alpha1.Check, 0, len(items))
			for _, item := range items {
				if check, ok := item.(*advisorv0alpha1.Check); ok {
					checkList.Items = append(checkList.Items, *check)
				}
			}
		}
	case "checktype":
		if checkTypeList, ok := list.(*advisorv0alpha1.CheckTypeList); ok {
			checkTypeList.Items = make([]advisorv0alpha1.CheckType, 0, len(items))
			for _, item := range items {
				if checkType, ok := item.(*advisorv0alpha1.CheckType); ok {
					checkTypeList.Items = append(checkTypeList.Items, *checkType)
				}
			}
		}
	}

	return list, nil
}

func (r *advisorStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	// Get namespace from request context (proper way)
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, fmt.Errorf("failed to get namespace from context: %w", err)
	}

	// Get metadata from the object
	meta, ok := obj.(metav1.Object)
	if !ok {
		return nil, fmt.Errorf("object does not implement metav1.Object")
	}

	// Handle generateName case
	name := meta.GetName()
	if name == "" {
		generateName := meta.GetGenerateName()
		if generateName == "" {
			return nil, fmt.Errorf("either name or generateName must be specified")
		}

		// Generate unique name with timestamp and random suffix
		// This follows Kubernetes naming convention: generateName + random-suffix
		rng := rand.New(rand.NewSource(time.Now().UnixNano()))
		randomSuffix := strconv.FormatInt(time.Now().UnixNano(), 36) + strconv.Itoa(rng.Intn(10000))
		name = generateName + randomSuffix

		// Set the generated name back on the object
		meta.SetName(name)
	}

	// Ensure the object has the correct namespace from the request context
	meta.SetNamespace(info.Value)

	key := info.Value + "/" + name

	r.mu.Lock()
	defer r.mu.Unlock()

	// Check if object already exists (only relevant for explicit names)
	if meta.GetGenerateName() == "" {
		if _, exists := r.items[key]; exists {
			return nil, fmt.Errorf("object already exists: %s", key)
		}
	}

	// Fake adding processed annotation
	if meta, ok := obj.(metav1.Object); ok {
		annotations := meta.GetAnnotations()
		if annotations == nil {
			annotations = make(map[string]string)
		}
		annotations[checks.StatusAnnotation] = "processed"
		meta.SetAnnotations(annotations)
	}

	// Store the object
	r.items[key] = obj.DeepCopyObject()

	return obj, nil
}

func (r *advisorStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	// Get namespace from request context (proper way)
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, fmt.Errorf("failed to get namespace from context: %w", err)
	}

	key := info.Value + "/" + name

	r.mu.Lock()
	defer r.mu.Unlock()

	// Get existing object
	oldObj, exists := r.items[key]

	// Get the updated object
	obj, err := objInfo.UpdatedObject(ctx, oldObj)
	if err != nil {
		return nil, false, err
	}

	// Fake adding processed annotation
	if meta, ok := obj.(metav1.Object); ok {
		annotations := meta.GetAnnotations()
		if annotations == nil {
			annotations = make(map[string]string)
		}
		annotations[checks.StatusAnnotation] = "processed"
		meta.SetAnnotations(annotations)
	}

	// Store the updated object
	r.items[key] = obj.DeepCopyObject()

	return obj, !exists, nil // created = !exists
}

func (r *advisorStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// Get namespace from request context (proper way)
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, fmt.Errorf("failed to get namespace from context: %w", err)
	}

	key := info.Value + "/" + name

	r.mu.Lock()
	defer r.mu.Unlock()

	// Get the object before deletion
	obj, exists := r.items[key]
	if !exists {
		return &metav1.Status{
			Status: metav1.StatusSuccess,
		}, false, nil
	}

	// Delete from storage
	delete(r.items, key)

	// Return the deleted object
	return obj.DeepCopyObject(), true, nil
}

func (r *advisorStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	r.items = make(map[string]runtime.Object)
	return &metav1.Status{
		Status: metav1.StatusSuccess,
	}, nil
}
