package generic

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/names"
)

type genericStrategy struct {
	runtime.ObjectTyper
	names.NameGenerator
}

// NewStrategy creates and returns a genericStrategy instance.
func NewStrategy(typer runtime.ObjectTyper) rest.RESTCreateUpdateStrategy {
	return genericStrategy{typer, names.SimpleNameGenerator}
}

// NamespaceScoped returns true because all Generic resources must be within a namespace.
func (genericStrategy) NamespaceScoped() bool {
	return true
}

// Creation setup -- no errors, typically just to remove things that can not be there
func (genericStrategy) PrepareForCreate(ctx context.Context, obj runtime.Object) {
	fmt.Printf("PrepareForCreate %v\n", obj.GetObjectKind().GroupVersionKind())
}

// Validate on create
func (genericStrategy) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	fmt.Printf("Validate %v\n", obj.GetObjectKind().GroupVersionKind())
	// Eventually the error list
	return field.ErrorList{}
}

// WarningsOnCreate returns warnings for the creation of the given object.
func (genericStrategy) WarningsOnCreate(ctx context.Context, obj runtime.Object) []string {
	fmt.Printf("WarningsOnCreate %v\n", obj.GetObjectKind().GroupVersionKind())
	// Potentially add warnings for formats
	return nil
}

func (genericStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	fmt.Printf("PrepareForUpdate %v\n", obj.GetObjectKind().GroupVersionKind())
}

func (genericStrategy) ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList {
	fmt.Printf("ValidateUpdate %v\n", obj.GetObjectKind().GroupVersionKind())
	return field.ErrorList{}
}

// WarningsOnUpdate returns warnings for the given update.
func (genericStrategy) WarningsOnUpdate(ctx context.Context, obj, old runtime.Object) []string {
	fmt.Printf("WarningsOnUpdate %v\n", obj.GetObjectKind().GroupVersionKind())
	return nil
}

func (genericStrategy) AllowCreateOnUpdate() bool {
	return true
}

func (genericStrategy) AllowUnconditionalUpdate() bool {
	return true // all an update when `resourceVersion` is not specified
}

func (genericStrategy) Canonicalize(obj runtime.Object) {}

// GetAttrs returns labels and fields of an object.
func GetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	accessor, err := meta.Accessor(obj)
	if err != nil {
		return nil, nil, err
	}
	fieldsSet := fields.Set{
		"metadata.name": accessor.GetName(),
	}
	return labels.Set(accessor.GetLabels()), fieldsSet, nil
}

// Matcher returns a generic.SelectionPredicate that matches on label and field selectors.
func Matcher(label labels.Selector, field fields.Selector) storage.SelectionPredicate {
	return storage.SelectionPredicate{
		Label:    label,
		Field:    field,
		GetAttrs: GetAttrs,
	}
}
