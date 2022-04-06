package kubecontroller

import (
	"context"

	"github.com/grafana/grafana/pkg/schema"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/types"
	ctrl "sigs.k8s.io/controller-runtime"
)

// Interface must be implemented by each Kubernetes-style controller of a
// Grafana model.
type Interface interface {
	// CRD should return the KubeController's CRD - the collection of schemas and
	// objects that Kubernetes requires to register and manage a
	// CustomResourceDefinition.
	CRD() schema.CRD

	// RegisterController should optionally register coremodel's controller to the manager.
	// If no controller is needed for the coremodel, it's safe to simply return nil from this method.
	RegisterController(ctrl.Manager) error
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
