package investigations

import (
	"context"
	"fmt"
	"strconv"
	"sync"
	"time"

	graphqlsubgraph "github.com/grafana/grafana-app-sdk/graphql/subgraph"
	"github.com/grafana/grafana-app-sdk/resource"
	investigationv0alpha1 "github.com/grafana/grafana/apps/investigations/pkg/apis/investigations/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
)

// investigationStorageAdapter adapts the existing REST storage to work with GraphQL
// This allows us to reuse existing storage implementations without duplicating logic
type investigationStorageAdapter struct {
	legacyStorage grafanarest.Storage
	namespacer    request.NamespaceMapper
}

// Ensure investigationStorageAdapter implements graphqlsubgraph.Storage
var _ graphqlsubgraph.Storage = (*investigationStorageAdapter)(nil)

// Get retrieves a single resource by namespace and name
func (a *investigationStorageAdapter) Get(ctx context.Context, namespace, name string) (resource.Object, error) {
	// Check if the storage supports getting
	getter, ok := a.legacyStorage.(rest.Getter)
	if !ok {
		return nil, fmt.Errorf("storage does not support get operations")
	}

	// Get the object using the REST storage
	obj, err := getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}

	// Convert to resource.Object
	resourceObj, ok := obj.(resource.Object)
	if !ok {
		return nil, fmt.Errorf("storage returned object that is not a resource.Object: %T", obj)
	}

	// Ensure we have proper TypeMeta set for resource handlers to work
	if investigation, ok := resourceObj.(*investigationv0alpha1.Investigation); ok {
		// ⚠️ CRITICAL: TypeMeta must be set for resource handlers to work
		investigation.TypeMeta = metav1.TypeMeta{
			APIVersion: investigationv0alpha1.GroupVersion.String(),
			Kind:       "Investigation",
		}
		return investigation, nil
	}

	if investigationIndex, ok := resourceObj.(*investigationv0alpha1.InvestigationIndex); ok {
		// ⚠️ CRITICAL: TypeMeta must be set for resource handlers to work
		investigationIndex.TypeMeta = metav1.TypeMeta{
			APIVersion: investigationv0alpha1.GroupVersion.String(),
			Kind:       "InvestigationIndex",
		}
		return investigationIndex, nil
	}

	return resourceObj, nil
}

// List retrieves multiple resources with optional filtering
func (a *investigationStorageAdapter) List(ctx context.Context, namespace string, options graphqlsubgraph.ListOptions) (resource.ListObject, error) {
	// Check if the storage supports listing
	lister, ok := a.legacyStorage.(rest.Lister)
	if !ok {
		return nil, fmt.Errorf("storage does not support list operations")
	}

	// Convert GraphQL list options to internal list options
	listOptions := &internalversion.ListOptions{}
	if options.LabelSelector != "" {
		// Parse label selector string into labels.Selector
		selector, err := labels.Parse(options.LabelSelector)
		if err != nil {
			return nil, fmt.Errorf("invalid label selector: %v", err)
		}
		listOptions.LabelSelector = selector
	}

	// Get the list using the REST storage
	listObj, err := lister.List(ctx, listOptions)
	if err != nil {
		return nil, err
	}

	// Convert to resource.ListObject and ensure TypeMeta is set
	if investigationList, ok := listObj.(*investigationv0alpha1.InvestigationList); ok {
		// Set TypeMeta on list object
		investigationList.TypeMeta = metav1.TypeMeta{
			APIVersion: investigationv0alpha1.GroupVersion.String(),
			Kind:       "InvestigationList",
		}

		// ⚠️ CRITICAL: Set TypeMeta on all items for resource handlers to work
		for i := range investigationList.Items {
			investigationList.Items[i].TypeMeta = metav1.TypeMeta{
				APIVersion: investigationv0alpha1.GroupVersion.String(),
				Kind:       "Investigation",
			}
		}
		return investigationList, nil
	}

	if investigationIndexList, ok := listObj.(*investigationv0alpha1.InvestigationIndexList); ok {
		// Set TypeMeta on list object
		investigationIndexList.TypeMeta = metav1.TypeMeta{
			APIVersion: investigationv0alpha1.GroupVersion.String(),
			Kind:       "InvestigationIndexList",
		}

		// ⚠️ CRITICAL: Set TypeMeta on all items for resource handlers to work
		for i := range investigationIndexList.Items {
			investigationIndexList.Items[i].TypeMeta = metav1.TypeMeta{
				APIVersion: investigationv0alpha1.GroupVersion.String(),
				Kind:       "InvestigationIndex",
			}
		}
		return investigationIndexList, nil
	}

	return nil, fmt.Errorf("storage returned unexpected list type: %T", listObj)
}

// Create creates a new resource
func (a *investigationStorageAdapter) Create(ctx context.Context, namespace string, obj resource.Object) (resource.Object, error) {
	// Check if the storage supports creation
	creater, ok := a.legacyStorage.(rest.Creater)
	if !ok {
		return nil, fmt.Errorf("storage does not support create operations")
	}

	// Set the namespace on the object if it's not already set
	if obj.GetNamespace() == "" {
		obj.SetNamespace(namespace)
	}

	// Create the object using the REST storage
	created, err := creater.Create(ctx, obj, rest.ValidateAllObjectFunc, &metav1.CreateOptions{})
	if err != nil {
		return nil, err
	}

	// Convert to resource.Object
	resourceObj, ok := created.(resource.Object)
	if !ok {
		return nil, fmt.Errorf("storage returned object that is not a resource.Object: %T", created)
	}

	return resourceObj, nil
}

// Update updates an existing resource
func (a *investigationStorageAdapter) Update(ctx context.Context, namespace, name string, obj resource.Object) (resource.Object, error) {
	// Check if the storage supports updates
	updater, ok := a.legacyStorage.(rest.Updater)
	if !ok {
		return nil, fmt.Errorf("storage does not support update operations")
	}

	// Set the namespace and name on the object
	obj.SetNamespace(namespace)
	obj.SetName(name)

	// Update the object using the REST storage
	updated, _, err := updater.Update(ctx, name, rest.DefaultUpdatedObjectInfo(obj), rest.ValidateAllObjectFunc, rest.ValidateAllObjectUpdateFunc, false, &metav1.UpdateOptions{})
	if err != nil {
		return nil, err
	}

	// Convert to resource.Object
	resourceObj, ok := updated.(resource.Object)
	if !ok {
		return nil, fmt.Errorf("storage returned object that is not a resource.Object: %T", updated)
	}

	return resourceObj, nil
}

// Delete deletes a resource by namespace and name
func (a *investigationStorageAdapter) Delete(ctx context.Context, namespace, name string) error {
	// Check if the storage supports deletion
	deleter, ok := a.legacyStorage.(rest.GracefulDeleter)
	if !ok {
		return fmt.Errorf("storage does not support delete operations")
	}

	// Delete the object using the REST storage
	_, _, err := deleter.Delete(ctx, name, rest.ValidateAllObjectFunc, &metav1.DeleteOptions{})
	return err
}

// investigationLegacyStorage provides in-memory storage for investigations
// This is a working implementation for development environments
type investigationLegacyStorage struct {
	gvr        schema.GroupVersionResource
	namespacer request.NamespaceMapper

	// In-memory storage
	mu    sync.RWMutex
	store map[string]runtime.Object // key: namespace/name

	// Resource version counter
	resourceVersionCounter int64
}

// Global storage instances (one per resource type)
var (
	investigationStorage      *investigationLegacyStorage
	investigationIndexStorage *investigationLegacyStorage
	storageOnce               sync.Once
)

// getOrCreateStorage returns the appropriate storage instance for the GVR
func getOrCreateStorage(gvr schema.GroupVersionResource, namespacer request.NamespaceMapper) *investigationLegacyStorage {
	storageOnce.Do(func() {
		investigationStorage = &investigationLegacyStorage{
			gvr:        gvr,
			namespacer: namespacer,
			store:      make(map[string]runtime.Object),
		}
		investigationIndexStorage = &investigationLegacyStorage{
			gvr:        gvr,
			namespacer: namespacer,
			store:      make(map[string]runtime.Object),
		}
	})

	if gvr.Resource == investigationv0alpha1.InvestigationKind().Plural() {
		investigationStorage.gvr = gvr
		investigationStorage.namespacer = namespacer
		return investigationStorage
	}
	if gvr.Resource == investigationv0alpha1.InvestigationIndexKind().Plural() {
		investigationIndexStorage.gvr = gvr
		investigationIndexStorage.namespacer = namespacer
		return investigationIndexStorage
	}

	// Fallback - create new instance
	return &investigationLegacyStorage{
		gvr:        gvr,
		namespacer: namespacer,
		store:      make(map[string]runtime.Object),
	}
}

// Helper to create a storage key
func (s *investigationLegacyStorage) storageKey(namespace, name string) string {
	if namespace == "" {
		return name
	}
	return namespace + "/" + name
}

// Helper to generate next resource version
func (s *investigationLegacyStorage) nextResourceVersion() string {
	s.resourceVersionCounter++
	return strconv.FormatInt(s.resourceVersionCounter, 10)
}

// Ensure investigationLegacyStorage implements the minimal required interfaces
var (
	_ rest.Scoper               = (*investigationLegacyStorage)(nil)
	_ rest.SingularNameProvider = (*investigationLegacyStorage)(nil)
	_ rest.Getter               = (*investigationLegacyStorage)(nil)
	_ rest.Lister               = (*investigationLegacyStorage)(nil)
	_ rest.Creater              = (*investigationLegacyStorage)(nil)
	_ rest.Updater              = (*investigationLegacyStorage)(nil)
	_ rest.GracefulDeleter      = (*investigationLegacyStorage)(nil)
	_ rest.Storage              = (*investigationLegacyStorage)(nil)
)

// New creates a new runtime object
func (s *investigationLegacyStorage) New() runtime.Object {
	if s.gvr.Resource == investigationv0alpha1.InvestigationKind().Plural() {
		return &investigationv0alpha1.Investigation{}
	}
	if s.gvr.Resource == investigationv0alpha1.InvestigationIndexKind().Plural() {
		return &investigationv0alpha1.InvestigationIndex{}
	}
	return nil
}

// NewList creates a new list runtime object
func (s *investigationLegacyStorage) NewList() runtime.Object {
	if s.gvr.Resource == investigationv0alpha1.InvestigationKind().Plural() {
		return &investigationv0alpha1.InvestigationList{}
	}
	if s.gvr.Resource == investigationv0alpha1.InvestigationIndexKind().Plural() {
		return &investigationv0alpha1.InvestigationIndexList{}
	}
	return nil
}

// Destroy cleans up the storage
func (s *investigationLegacyStorage) Destroy() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.store = make(map[string]runtime.Object)
}

// NamespaceScoped returns whether this resource is namespace scoped
func (s *investigationLegacyStorage) NamespaceScoped() bool {
	return true
}

// GetSingularName returns the singular name for the resource
func (s *investigationLegacyStorage) GetSingularName() string {
	if s.gvr.Resource == investigationv0alpha1.InvestigationKind().Plural() {
		return investigationv0alpha1.InvestigationKind().Kind()
	}
	if s.gvr.Resource == investigationv0alpha1.InvestigationIndexKind().Plural() {
		return investigationv0alpha1.InvestigationIndexKind().Kind()
	}
	return "unknown"
}

// ConvertToTable converts objects to table format (minimal implementation)
func (s *investigationLegacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return &metav1.Table{}, nil
}

// Get retrieves a single resource
func (s *investigationLegacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Try with default namespace first, then without namespace
	key := s.storageKey("default", name)
	obj, exists := s.store[key]
	if !exists {
		key = s.storageKey("", name)
		obj, exists = s.store[key]
	}

	if !exists {
		return nil, fmt.Errorf("investigations.grafana.app \"%s\" not found", name)
	}

	// Return a deep copy to avoid mutation issues
	return obj.DeepCopyObject(), nil
}

// List retrieves multiple resources
func (s *investigationLegacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.gvr.Resource == investigationv0alpha1.InvestigationKind().Plural() {
		var items []investigationv0alpha1.Investigation

		for _, obj := range s.store {
			if investigation, ok := obj.(*investigationv0alpha1.Investigation); ok {
				// Apply label selector if provided
				if options.LabelSelector != nil {
					objLabels := investigation.GetLabels()
					if objLabels == nil {
						objLabels = make(map[string]string)
					}
					if !options.LabelSelector.Matches(labels.Set(objLabels)) {
						continue
					}
				}
				items = append(items, *investigation.DeepCopy())
			}
		}

		return &investigationv0alpha1.InvestigationList{
			TypeMeta: metav1.TypeMeta{
				APIVersion: investigationv0alpha1.GroupVersion.String(),
				Kind:       "InvestigationList",
			},
			Items: items,
		}, nil
	}

	if s.gvr.Resource == investigationv0alpha1.InvestigationIndexKind().Plural() {
		var items []investigationv0alpha1.InvestigationIndex

		for _, obj := range s.store {
			if investigationIndex, ok := obj.(*investigationv0alpha1.InvestigationIndex); ok {
				// Apply label selector if provided
				if options.LabelSelector != nil {
					objLabels := investigationIndex.GetLabels()
					if objLabels == nil {
						objLabels = make(map[string]string)
					}
					if !options.LabelSelector.Matches(labels.Set(objLabels)) {
						continue
					}
				}
				items = append(items, *investigationIndex.DeepCopy())
			}
		}

		return &investigationv0alpha1.InvestigationIndexList{
			TypeMeta: metav1.TypeMeta{
				APIVersion: investigationv0alpha1.GroupVersion.String(),
				Kind:       "InvestigationIndexList",
			},
			Items: items,
		}, nil
	}

	return nil, fmt.Errorf("unknown resource type: %s", s.gvr.Resource)
}

// Create creates a new resource
func (s *investigationLegacyStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Validate the object
	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	var objMeta metav1.Object
	var name, namespace string

	// Extract metadata based on object type
	if investigation, ok := obj.(*investigationv0alpha1.Investigation); ok {
		objMeta = &investigation.ObjectMeta
		name = investigation.Name
		namespace = investigation.Namespace
		if namespace == "" {
			namespace = "default"
			investigation.Namespace = namespace
		}
	} else if investigationIndex, ok := obj.(*investigationv0alpha1.InvestigationIndex); ok {
		objMeta = &investigationIndex.ObjectMeta
		name = investigationIndex.Name
		namespace = investigationIndex.Namespace
		if namespace == "" {
			namespace = "default"
			investigationIndex.Namespace = namespace
		}
	} else {
		return nil, fmt.Errorf("unsupported object type: %T", obj)
	}

	if name == "" {
		return nil, fmt.Errorf("name is required")
	}

	key := s.storageKey(namespace, name)

	// Check if already exists
	if _, exists := s.store[key]; exists {
		return nil, fmt.Errorf("investigations.grafana.app \"%s\" already exists", name)
	}

	// Set metadata
	now := metav1.NewTime(time.Now())
	resourceVersion := s.nextResourceVersion()

	objMeta.SetCreationTimestamp(now)
	objMeta.SetResourceVersion(resourceVersion)
	objMeta.SetGeneration(1)

	// Create a deep copy and store it
	stored := obj.DeepCopyObject()
	s.store[key] = stored

	// Return a deep copy
	return obj.DeepCopyObject(), nil
}

// Update updates an existing resource
func (s *investigationLegacyStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	namespace := "default" // Default namespace
	key := s.storageKey(namespace, name)

	// Get existing object
	existing, exists := s.store[key]
	if !exists {
		if !forceAllowCreate {
			return nil, false, fmt.Errorf("investigations.grafana.app \"%s\" not found", name)
		}
		// Handle create case if forceAllowCreate is true
		// This is a simplified version - in practice you'd want more sophisticated logic
		return nil, false, fmt.Errorf("create via update not implemented")
	}

	// Get the updated object
	updated, err := objInfo.UpdatedObject(ctx, existing)
	if err != nil {
		return nil, false, err
	}

	// Validate the update
	if updateValidation != nil {
		if err := updateValidation(ctx, updated, existing); err != nil {
			return nil, false, err
		}
	}

	var objMeta metav1.Object

	// Extract metadata based on object type
	if investigation, ok := updated.(*investigationv0alpha1.Investigation); ok {
		objMeta = &investigation.ObjectMeta
	} else if investigationIndex, ok := updated.(*investigationv0alpha1.InvestigationIndex); ok {
		objMeta = &investigationIndex.ObjectMeta
	} else {
		return nil, false, fmt.Errorf("unsupported object type: %T", updated)
	}

	// Update metadata
	resourceVersion := s.nextResourceVersion()
	objMeta.SetResourceVersion(resourceVersion)
	if generation := objMeta.GetGeneration(); generation == 0 {
		objMeta.SetGeneration(1)
	} else {
		objMeta.SetGeneration(generation + 1)
	}

	// Store the updated object
	stored := updated.DeepCopyObject()
	s.store[key] = stored

	// Return a deep copy
	return updated.DeepCopyObject(), false, nil
}

// Delete deletes a resource
func (s *investigationLegacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	namespace := "default" // Default namespace
	key := s.storageKey(namespace, name)

	// Get existing object
	existing, exists := s.store[key]
	if !exists {
		return nil, true, fmt.Errorf("investigations.grafana.app \"%s\" not found", name)
	}

	// Validate the deletion
	if deleteValidation != nil {
		if err := deleteValidation(ctx, existing); err != nil {
			return nil, false, err
		}
	}

	// Remove from store
	delete(s.store, key)

	// Return the deleted object
	return existing.DeepCopyObject(), true, nil
}

// DeleteCollection deletes multiple resources
func (s *investigationLegacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// For simplicity, just clear the entire store
	// In a real implementation, you'd apply the list options and selectively delete
	s.store = make(map[string]runtime.Object)

	return &metav1.Status{
		Status: metav1.StatusSuccess,
	}, nil
}
