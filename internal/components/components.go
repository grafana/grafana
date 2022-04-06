package components

import (
	"context"

	"github.com/grafana/grafana/pkg/schema"
	"github.com/grafana/thema"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
)

// KubeModel is an interface that must be implemented by each KubeModel-style representation of a Grafana model.
type KubeModel interface {
	// Schema should return coremodel's schema.
	Schema() schema.KubeResource

	// RegisterController should optionally register coremodel's controller to the manager.
	// If no controller is needed for the coremodel, it's safe to simply return nil from this method.
	RegisterController(ctrl.Manager) error
}

// Coremodel is an interface that must be implemented by all Grafana coremodels.
// A coremodel is the foundational, canonical schema for some
// known-at-compile-time Grafana object.
//
// Coremodels are expressed as Thema lineages.
type Coremodel interface {
	// Lineage should return the canonical Thema lineage for the coremodel.
	Lineage() thema.Lineage

	// Current should return the schema of the version that the Grafana backend
	// is currently written against. (While Grafana can accept data from all
	// older versions of the Thema schema, backend Go code is written against a
	// single version for simplicity)
	Current() thema.Schema

	// GoType should return a pointer to the Go struct type that corresponds to
	// the Current() schema.
	GoType() interface{}
}

// SchemaLoader is a generic schema loader, that can load different schema types.
type SchemaLoader interface {
	LoadSchema(
		context.Context, schema.SchemaType, schema.ThemaLoaderOpts, schema.GoLoaderOpts,
	) (schema.KubeResource, error)
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
