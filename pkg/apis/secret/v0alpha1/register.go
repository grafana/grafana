package v0alpha1

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"

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
			{Name: "Description", Type: "string", Format: "string", Description: "Short description that explains the purpose of this SecureValue"},
			{Name: "Keeper", Type: "string", Format: "string", Description: "Storage of the secure value"},
			{Name: "Ref", Type: "string", Format: "string", Description: "If present, the reference to a secret"},
			{Name: "Status", Type: "string", Format: "string", Description: "The status of the secure value"},
		},
		// Decodes the object into a concrete type. Return order in the slice must be the same as in `Definition`.
		Reader: func(obj any) ([]interface{}, error) {
			r, ok := obj.(*SecureValue)
			if ok {
				return []interface{}{
					r.Name,
					r.Spec.Description,
					r.Spec.Keeper,
					r.Spec.Ref,
					r.Status.Phase,
				}, nil
			}

			return nil, fmt.Errorf("expected SecureValue but got %T", obj)
		},
	},
)

var KeeperResourceInfo = utils.NewResourceInfo(
	GROUP,
	VERSION,
	"keepers", // resource name (e.g. `kubectl get keepers`).
	"keeper",  // singular name. Used when creating a resource (e.g. `keeper-xxx`).
	"Keeper",  // kind.
	func() runtime.Object { return &Keeper{} },     // constructor for single object. This is used by the rest storage layer `Create` method.
	func() runtime.Object { return &KeeperList{} }, // constructor for list object. This is used by the rest storage layer `List` method.
	utils.TableColumns{
		// This defines the fields we view in `kubectl get`. Not related with the storage layer.
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Description", Type: "string", Format: "string", Description: "Short description for the Keeper"},
		},
		// Decodes the object into a concrete type. Return order in the slice must be the same as in `Definition`.
		Reader: func(obj any) ([]interface{}, error) {
			r, ok := obj.(*Keeper)
			if ok {
				return []interface{}{
					r.Name,
					r.Spec.Description,
				}, nil
			}

			return nil, fmt.Errorf("expected Keeper but got %T", obj)
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

// Adds the status phase to the selectable fields, besides the generic metadata name and namespace.
func SelectableSecureValueFields(obj *SecureValue) fields.Set {
	return generic.MergeFieldsSets(generic.ObjectMetaFieldsSet(&obj.ObjectMeta, false), fields.Set{
		"status.phase": string(obj.Status.Phase),
	})
}

// Adds the list of known types to the given scheme.
func AddKnownTypes(scheme *runtime.Scheme, version string) error {
	// TODO: do we need a type for the secure value decrypt?
	// Since it is a subresource, it could be interesting to not use `SecureValue`, but rather something distinct like `DecryptedSecureValue`?
	scheme.AddKnownTypes(
		schema.GroupVersion{Group: GROUP, Version: version},
		&SecureValue{},
		&SecureValueList{},
		&Keeper{},
		&KeeperList{},
		// &secretV0.SecureValueActivityList{},
	)

	err := scheme.AddFieldLabelConversionFunc(
		SecureValuesResourceInfo.GroupVersionKind(),
		func(label, value string) (string, string, error) {
			fieldSet := SelectableSecureValueFields(&SecureValue{})
			for key := range fieldSet {
				if label == key {
					return label, value, nil
				}
			}
			return "", "", fmt.Errorf("field label not supported for %s: %s", SecureValuesResourceInfo.GroupVersionKind(), label)
		},
	)
	if err != nil {
		return err
	}
	return nil
}
