package unstructured

import (
	"encoding/json"
	"reflect"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	runtime "k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	openapi "k8s.io/kube-openapi/pkg/common"
	spec "k8s.io/kube-openapi/pkg/validation/spec"
)

var (
	_ runtime.Object    = (*Unstructured)(nil)
	_ schema.ObjectKind = (*Unstructured)(nil)
)

// Unstructured allows objects that do not have Golang structs registered to be manipulated
// generically.
type Unstructured struct {
	// Object is a JSON compatible map with string, float, int, bool, []any,
	// or map[string]any children.
	Object map[string]any
}

func (u *Unstructured) SetGroupVersionKind(gvk schema.GroupVersionKind) {
	if u.Object == nil {
		u.Object = make(map[string]any)
	}
	u.Object["apiVersion"] = gvk.GroupVersion().String()
	u.Object["kind"] = gvk.Kind
}

func (u *Unstructured) GroupVersionKind() schema.GroupVersionKind {
	gv, err := schema.ParseGroupVersion(u.GetAPIVersion())
	if err != nil {
		return schema.GroupVersionKind{}
	}
	gvk := gv.WithKind(u.GetKind())
	return gvk
}

// GetObjectKind implements [runtime.Object].
func (u *Unstructured) GetObjectKind() schema.ObjectKind {
	return u
}

func (u *Unstructured) GetAPIVersion() string {
	v, _, _ := unstructured.NestedString(u.Object, "apiVersion")
	return v
}

func (u *Unstructured) GetKind() string {
	v, _, _ := unstructured.NestedString(u.Object, "kind")
	return v
}

func (Unstructured) OpenAPIModelName() string {
	return "com.github.grafana.grafana.pkg.apimachinery.Unstructured"
}

// Produce an API definition that represents map[string]any
func (u Unstructured) OpenAPIDefinition() openapi.OpenAPIDefinition {
	return openapi.OpenAPIDefinition{
		Schema: spec.Schema{
			SchemaProps: spec.SchemaProps{
				Type:                 []string{"object"},
				AdditionalProperties: &spec.SchemaOrBool{Allows: true},
			},
			VendorExtensible: spec.VendorExtensible{
				Extensions: map[string]any{
					"x-kubernetes-preserve-unknown-fields": true,
				},
			},
		},
	}
}

func (u *Unstructured) IsZero() bool {
	return len(u.Object) == 0
}

// MarshalJSON ensures that the unstructured object produces proper
// JSON when passed to Go's standard JSON library.
func (u Unstructured) MarshalJSON() ([]byte, error) {
	return json.Marshal(u.Object)
}

// UnmarshalJSON ensures that the unstructured object properly decodes
// JSON when passed to Go's standard JSON library.
func (u *Unstructured) UnmarshalJSON(b []byte) error {
	return json.Unmarshal(b, &u.Object)
}

func (u *Unstructured) DeepCopyObject() runtime.Object {
	return u.DeepCopy()
}

func (u *Unstructured) DeepCopy() *Unstructured {
	if u == nil {
		return nil
	}
	out := new(Unstructured)
	*out = *u
	out.Object = deepCopyJSONValue(u.Object).(map[string]any)
	return out
}

func (u *Unstructured) DeepCopyInto(out *Unstructured) {
	clone := u.DeepCopy()
	*out = *clone
}

// Copied from:
//
//	runtime.DeepCopyJSON(u.Object)
//
// BUT this avoids panic on int
func deepCopyJSONValue(x any) any {
	switch x := x.(type) {
	case map[string]any:
		if x == nil {
			// Typed nil - an any that contains a type map[string]any with a value of nil
			return x
		}
		clone := make(map[string]any, len(x))
		for k, v := range x {
			clone[k] = deepCopyJSONValue(v)
		}
		return clone
	case []any:
		if x == nil {
			// Typed nil - an any that contains a type []any with a value of nil
			return x
		}
		clone := make([]any, len(x))
		for i, v := range x {
			clone[i] = deepCopyJSONValue(v)
		}
		return clone
	case string, int64, bool, float64, nil, json.Number:
		return x

	// Keep more numbers
	case int, int8, int16, int32, float32, uint, uint16, uint32, uint64, uint8:
		return x

	case runtime.Object:
		return x.DeepCopyObject()

	default:
		// fallback to reflection
		val := reflect.ValueOf(x).Elem()
		cpy := reflect.New(val.Type())
		cpy.Elem().Set(val)

		// Using the <obj>, <ok> for the type conversion ensures that it doesn't panic if it can't be converted
		if obj, ok := cpy.Interface().(runtime.Object); ok {
			return obj
		}
		return x
	}
}
