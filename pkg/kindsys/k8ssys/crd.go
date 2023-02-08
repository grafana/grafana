package k8ssys

import (
	"fmt"
	"reflect"

	"github.com/grafana/grafana/pkg/kindsys"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8schema "k8s.io/apimachinery/pkg/runtime/schema"
)

type Kind struct {
	GrafanaKind kindsys.Kind
	Object      runtime.Object // singular type
	ObjectList  runtime.Object // list type
	Schema      apiextensionsv1.CustomResourceDefinition
}

// TODO this could probably be done in CUE/framework
func (crd Kind) GVK() k8schema.GroupVersionKind {
	// TODO custom structured
	props := crd.GrafanaKind.Props().(kindsys.CoreProperties)
	gvk := k8schema.GroupVersionKind{
		Group: fmt.Sprintf("%s.core.grafana.com", props.MachineName),
		Kind:  props.Name,
	}
	if props.Maturity.Less(kindsys.MaturityStable) {
		gvk.Version = "v0-0alpha1"
	} else {
		gvk.Version = fmt.Sprintf("v%d-%d", props.CurrentVersion[0], props.CurrentVersion[1])
	}

	return gvk
}

// CustomResourceDefinitionList is the kubernetes-API-compliant representation of a list of CustomResourceDefinitions
type CustomResourceDefinitionList struct {
	ListBase[CustomResourceDefinition]
}

// CustomResourceDefinition is the kubernetes-API-compliant representation of a Custom Resource Definition
type CustomResourceDefinition struct {
	metav1.TypeMeta   `json:",inline" yaml:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty" yaml:"metadata,omitempty"`
	Spec              CustomResourceDefinitionSpec `json:"spec"`
}

// DeepCopyObject implements runtime.Object.
func (crd *CustomResourceDefinition) DeepCopyObject() runtime.Object {
	return DeepCopyObject(crd)
}

// CustomResourceDefinitionSpec is the body or spec of a kubernetes Custom Resource Definition
type CustomResourceDefinitionSpec struct {
	Group    string                                `json:"group" yaml:"group"`
	Versions []CustomResourceDefinitionSpecVersion `json:"versions" yaml:"versions"`
	Names    CustomResourceDefinitionSpecNames     `json:"names" yaml:"names"`
	Scope    string                                `json:"scope" yaml:"scope"`
}

// CustomResourceDefinitionSpecVersion is the representation of a specific version of a CRD, as part of the overall spec
type CustomResourceDefinitionSpecVersion struct {
	Name         string         `json:"name" yaml:"name"`
	Served       bool           `json:"served" yaml:"served"`
	Storage      bool           `json:"storage" yaml:"storage"`
	Schema       map[string]any `json:"schema" yaml:"schema"`
	Subresources map[string]any `json:"subresources,omitempty" yaml:"subresources,omitempty"`
}

// CustomResourceDefinitionSpecNames is the struct representing the names (kind and plural) of a kubernetes CRD
type CustomResourceDefinitionSpecNames struct {
	Kind   string `json:"kind" yaml:"kind"`
	Plural string `json:"plural" yaml:"plural"`
}

// Base is a struct which describes a basic CRD, and implements runtime.Object.
// SpecType should be the struct that represents the spec in the definition.
// It cannot be used on its own, as the name of the CRD in kubernetes must exactly match the name of struct.
// Instead, this struct can be used as a component of a new named struct, for examples:
//
//	type MyCustomResource struct {
//	    crd.Base[MyCustomResourceSpec]
//	}
type Base[SpecType any] struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	Spec              SpecType `json:"spec"`
}

// DeepCopyObject is implemented for Base so it will implement runtime.Object.
// DeepCopyObject here just calls crd.DeepCopyObject on itself.
func (b *Base[T]) DeepCopyObject() runtime.Object {
	return DeepCopyObject(b)
}

// ListBase is a struct which describes a list of CRDs, and implements runtime.Object.
// ItemType should be the CRD type being listed (NOT the model).
// It cannot be used on its own, as the struct name must exactly match `<name of kubernetes CRD>List`.
// Instead, this struct can be used as a component of a new named struct, for examples:
//
//	type MyCustomResourceList struct {
//	    crd.Base[MyCustomResource]
//	}
type ListBase[ItemType any] struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata"`
	Items           []ItemType `json:"items"`
}

// DeepCopyObject is implemented for Base so it will implement runtime.Object.
// DeepCopyObject here just calls crd.DeepCopyObject on itself.
func (b *ListBase[T]) DeepCopyObject() runtime.Object {
	return DeepCopyObject(b)
}

// BaseStatus extends Base by including a Status subresource.
// This should be used if your kubernetes CRD includes the status subresource and you want to be able to view/modify it.
// Usage is identical to Base
type BaseStatus[SpecType, StatusType any] struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
	Spec              SpecType   `json:"spec"`
	Status            StatusType `json:"status"`
}

// DeepCopyObject is implemented for Base so it will implement runtime.Object.
// DeepCopyObject here just calls crd.DeepCopyObject on itself.
func (b *BaseStatus[T, S]) DeepCopyObject() runtime.Object {
	return DeepCopyObject(b)
}

// DeepCopyObject is an implementation of the receiver method required for implementing runtime.Object.
// It should be used in your own runtime.Object implementations if you do not wish to implement custom behavior.
// Example:
//
//	func (c *CustomObject) DeepCopyObject() runtime.Object {
//	    return crd.DeepCopyObject(c)
//	}
func DeepCopyObject(in any) runtime.Object {
	val := reflect.ValueOf(in).Elem()

	cpy := reflect.New(val.Type())
	cpy.Elem().Set(val)

	// Using the <obj>, <ok> for the type conversion ensures that it doesn't panic if it can't be converted
	if obj, ok := cpy.Interface().(runtime.Object); ok {
		return obj
	}

	// TODO: better return than nil?
	return nil
}
