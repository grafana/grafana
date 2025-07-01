package playlist

import (
	"context"
	"fmt"

	graphqlsubgraph "github.com/grafana/grafana-app-sdk/graphql/subgraph"
	"github.com/grafana/grafana-app-sdk/resource"
	playlistv0alpha1 "github.com/grafana/grafana/apps/playlist/pkg/apis/playlist/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
)

// playlistStorageAdapter adapts the existing REST storage to work with GraphQL
// This allows us to reuse existing storage implementations without duplicating logic
type playlistStorageAdapter struct {
	legacyStorage grafanarest.Storage
	namespacer    request.NamespaceMapper
}

// Ensure playlistStorageAdapter implements graphqlsubgraph.Storage
var _ graphqlsubgraph.Storage = (*playlistStorageAdapter)(nil)

// ensureTypeMetaSet ensures that the TypeMeta is properly set on a resource object
// This is critical for GraphQL resource handlers to be called during conversion
func (a *playlistStorageAdapter) ensureTypeMetaSet(obj resource.Object) {
	// Check if TypeMeta is already set
	gvk := obj.GroupVersionKind()
	if gvk.Kind == "" || gvk.Version == "" {
		// Set proper TypeMeta for playlist resources
		kind := playlistv0alpha1.PlaylistKind()
		obj.SetGroupVersionKind(schema.GroupVersionKind{
			Group:   kind.Group(),
			Version: kind.Version(),
			Kind:    kind.Kind(),
		})
	}
}

// Get retrieves a single resource by namespace and name
func (a *playlistStorageAdapter) Get(ctx context.Context, namespace, name string) (resource.Object, error) {
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

	// CRITICAL: Ensure TypeMeta is set for GraphQL resource handlers to work
	a.ensureTypeMetaSet(resourceObj)

	return resourceObj, nil
}

// List retrieves multiple resources with optional filtering
func (a *playlistStorageAdapter) List(ctx context.Context, namespace string, options graphqlsubgraph.ListOptions) (resource.ListObject, error) {
	// Check if the storage supports listing
	lister, ok := a.legacyStorage.(rest.Lister)
	if !ok {
		return nil, fmt.Errorf("storage does not support list operations")
	}

	// Convert GraphQL list options to Kubernetes list options
	listOptions := &internalversion.ListOptions{}
	if options.LabelSelector != "" {
		// Parse label selector string into labels.Selector
		selector, err := labels.Parse(options.LabelSelector)
		if err != nil {
			return nil, fmt.Errorf("invalid label selector: %v", err)
		}
		listOptions.LabelSelector = selector
	}
	if options.Limit > 0 {
		listOptions.Limit = options.Limit
	}
	if options.Continue != "" {
		listOptions.Continue = options.Continue
	}

	// Perform the list operation
	obj, err := lister.List(ctx, listOptions)
	if err != nil {
		return nil, err
	}

	// Convert to resource.ListObject
	listObj, ok := obj.(resource.ListObject)
	if !ok {
		return nil, fmt.Errorf("storage returned object that is not a resource.ListObject: %T", obj)
	}

	// CRITICAL: Ensure TypeMeta is set on all items for GraphQL resource handlers to work
	items := listObj.GetItems()
	for _, item := range items {
		a.ensureTypeMetaSet(item)
	}

	return listObj, nil
}

// Create creates a new resource
func (a *playlistStorageAdapter) Create(ctx context.Context, namespace string, obj resource.Object) (resource.Object, error) {
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
func (a *playlistStorageAdapter) Update(ctx context.Context, namespace, name string, obj resource.Object) (resource.Object, error) {
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
func (a *playlistStorageAdapter) Delete(ctx context.Context, namespace, name string) error {
	// Check if the storage supports deletion
	deleter, ok := a.legacyStorage.(rest.GracefulDeleter)
	if !ok {
		return fmt.Errorf("storage does not support delete operations")
	}

	// Delete the object using the REST storage
	_, _, err := deleter.Delete(ctx, name, rest.ValidateAllObjectFunc, &metav1.DeleteOptions{})
	return err
}
