package components

import (
	"context"

	"github.com/grafana/grafana/pkg/schema"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
)

// Coremodel is an interface that must be implemented by each coremodel.
type Coremodel interface {
	// Schema should return coremodel's schema.
	Schema() schema.ObjectSchema

	// RegisterController should optionally register coremodel's controller to the manager.
	// If no controller is needed for the coremodel, it's safe to simply return nil from this method.
	RegisterController(ctrl.Manager) error
}

// CoremodelProvider is a wire-friendly func that provides a coremodel.
type CoremodelProvider func(store Store, loader SchemaLoader) (*Coremodel, error)

// SchemaLoader is a generic schema loader, that can load different schema types.
type SchemaLoader interface {
	LoadSchema(
		context.Context, schema.SchemaType, schema.ThemaLoaderOpts, schema.GoLoaderOpts,
	) (schema.ObjectSchema, error)
}

// Store is a generic durable storage for coremodels.
//
// TODO: I think we should define a generic store interface similar to k8s rest.Interface
// and have storeset around (similar to clientset) from which we can grab specific store implementation for schema.
type Store interface {
	// Get retrieves a coremodel with specified namespaced name from the store into the object.
	Get(context.Context, types.NamespacedName, runtime.Object) error

	// Delete deletes the coremodel with specified namespaced name from the store.
	Delete(context.Context, types.NamespacedName) error

	// Insert inserts the coremodel object into the store.
	Insert(context.Context, runtime.Object) error

	// Update updates the coremodel object in the store.
	Update(context.Context, runtime.Object) error
}
