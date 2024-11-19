package v0alpha1

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	GROUP   = "secret.grafana.app"
	VERSION = "v0alpha1"
)

// SecureValuesResourceInfo is used when registering the API service.
var SecureValuesResourceInfo = utils.NewResourceInfo(
	GROUP,
	VERSION,
	"securevalues", // resource name (e.g. `kubectl get securevalues`).
	"securevalue",  // singular name. Used when creating a resource (e.g. `securevalue-xxx`).
	"SecureValue",  // kind.
	func() runtime.Object { return &SecureValue{} },     // constructor for single object. This is used by the rest storage layer `Create` method.
	func() runtime.Object { return &SecureValueList{} }, // constructor for list object. This is used by the rest storage layer `List` method.
	utils.TableColumns{
		// This defines the fields we view in `kubectl get`. Not related with the storage layer.
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The display name of the secure value"},
			{Name: "Manager", Type: "string", Format: "string", Description: "Values managed by remote services"},
		},
		// Decodes the object into a concrete type. Return order in the slice must be the same as in `Definition`.
		Reader: func(obj any) ([]interface{}, error) {
			r, ok := obj.(*SecureValue)
			if ok {
				return []interface{}{
					r.Name,
					r.Spec.Title,
					r.Spec.Manager,
				}, nil
			}

			return nil, fmt.Errorf("expected SecureValue but got %T", obj)
		},
	},
)

// KeyManagerResourceInfo is declared here but registered and implemented in Enterprise.
var KeyManagerResourceInfo = utils.NewResourceInfo(
	GROUP,
	VERSION,
	"keymanagers", // resource name (e.g. `kubectl get keymanagers`).
	"keymanager",  // singular name. Used when creating a resource (e.g. `keymanager-xxx`).
	"KeyManager",  // kind.
	func() runtime.Object { return &KeyManager{} },     // constructor for single object. This is used by the rest storage layer `Create` method.
	func() runtime.Object { return &KeyManagerList{} }, // constructor for list object. This is used by the rest storage layer `List` method.
	utils.TableColumns{
		// This defines the fields we view in `kubectl get`. Not related with the storage layer.
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The display name of the key manager"},
			{Name: "Provider", Type: "string", Format: "string", Description: "The provider type"},
		},
		// Decodes the object into a concrete type. Return order in the slice must be the same as in `Definition`.
		Reader: func(obj any) ([]interface{}, error) {
			r, ok := obj.(*KeyManager)
			if ok {
				return []interface{}{
					r.Name,
					r.Spec.Title,
					r.Spec.Provider,
				}, nil
			}

			return nil, fmt.Errorf("expected KeyManager but got %T", obj)
		},
	},
)

var (
	// SchemeGroupVersion is group version used to register these objects.
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}

	// SchemaBuilder is used by standard codegen, this is not used in the code otherwise.
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
)

// Adds the list of known types to the given scheme.
func AddKnownTypes(scheme *runtime.Scheme, version string) {
	// TODO: do we need a type for the secure value decrypt?
	// Since it is a subresource, it could be interesting to not use `SecureValue`, but rather something distinct like `DecryptedSecureValue`?
	scheme.AddKnownTypes(
		schema.GroupVersion{Group: GROUP, Version: version},
		&SecureValue{},
		&SecureValueList{},
		&KeyManager{},
		&KeyManagerList{},
		&SecureValueActivityList{},
	)
}
