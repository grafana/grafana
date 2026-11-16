package kindstore

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/managedfields"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"
)

// defaultFieldManager names the manager for a request that does not name one.
// The generic handler falls back to the request's user agent, which storage
// cannot see.
const defaultFieldManager = "grafana"

// newFieldManager builds the field manager a manifest kind uses to track
// managedFields on create.
//
// The generic create handler already runs one, but it diffs the submitted object
// against an empty object it asks the scheme for, and for a kind registered as
// unstructured the scheme returns a bare &unstructured.Unstructured{}: no
// apiVersion, no kind, and so nothing any converter can version. The handler
// logs "[SHOULD NOT HAPPEN] failed to update managedFields" and drops
// managedFields instead. This one starts from a live object that carries the
// GVK, the same fix-up apimachinery already applies on the apply path.
func newFieldManager(gvk schema.GroupVersionKind, resetFields map[fieldpath.APIVersion]*fieldpath.Set) (*managedfields.FieldManager, error) {
	return managedfields.NewDefaultFieldManager(
		// The OpenAPI model published for manifest kinds is an untyped object, so
		// deducing the types from the object itself tracks the same fields the
		// generic handler would track on later writes.
		managedfields.NewDeducedTypeConverter(),
		unstructuredConvertor{},
		unstructuredDefaulter{},
		unstructuredCreator{},
		gvk,
		schema.GroupVersion{Group: gvk.Group, Version: runtime.APIVersionInternal},
		"", // the main resource; status is dropped through resetFields
		fieldpath.NewExcludeFilterSetMap(resetFields),
	)
}

// unstructuredCreator returns the empty objects the field manager diffs against,
// with their GVK set.
type unstructuredCreator struct{}

func (unstructuredCreator) New(gvk schema.GroupVersionKind) (runtime.Object, error) {
	u := &unstructured.Unstructured{}
	u.SetGroupVersionKind(gvk)
	return u, nil
}

// unstructuredConvertor versions manifest kinds the way apiextensions versions a
// custom resource with no conversion strategy: every version serves the payload
// as stored, so converting is stamping the target version onto a copy.
type unstructuredConvertor struct{}

func (c unstructuredConvertor) ConvertToVersion(in runtime.Object, target runtime.GroupVersioner) (runtime.Object, error) {
	u, ok := in.(*unstructured.Unstructured)
	if !ok {
		return nil, fmt.Errorf("cannot convert %T, expected an unstructured object", in)
	}
	from := u.GroupVersionKind()
	to, ok := target.KindForGroupVersionKinds([]schema.GroupVersionKind{from})
	if !ok {
		return nil, fmt.Errorf("%v cannot be converted to %q", from, target)
	}
	out := u.DeepCopy()
	out.SetGroupVersionKind(to)
	return out, nil
}

func (c unstructuredConvertor) Convert(in, out, context interface{}) error {
	inObj, ok := in.(runtime.Object)
	if !ok {
		return fmt.Errorf("cannot convert %T, expected a runtime object", in)
	}
	outObj, ok := out.(*unstructured.Unstructured)
	if !ok {
		return fmt.Errorf("cannot convert to %T, expected an unstructured object", out)
	}
	converted, err := c.ConvertToVersion(inObj, outObj.GroupVersionKind().GroupVersion())
	if err != nil {
		return err
	}
	outObj.SetUnstructuredContent(converted.(*unstructured.Unstructured).UnstructuredContent())
	return nil
}

func (unstructuredConvertor) ConvertFieldLabel(gvk schema.GroupVersionKind, label, value string) (string, string, error) {
	return label, value, nil
}

// unstructuredDefaulter is a no-op: a manifest kind has no defaulting funcs.
type unstructuredDefaulter struct{}

func (unstructuredDefaulter) Default(runtime.Object) {}
