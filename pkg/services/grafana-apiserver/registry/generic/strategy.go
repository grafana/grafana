package generic

import (
	"context"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/names"
)

type genericStrategy struct {
	runtime.ObjectTyper
	names.NameGenerator
}

// NewStrategy creates and returns a genericStrategy instance.
func NewStrategy(typer runtime.ObjectTyper) genericStrategy {
	return genericStrategy{typer, names.SimpleNameGenerator}
}

// NamespaceScoped returns true because all Generic resources must be within a namespace.
func (genericStrategy) NamespaceScoped() bool {
	return true
}

func (genericStrategy) PrepareForCreate(ctx context.Context, obj runtime.Object) {}

func (genericStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {}

func (genericStrategy) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnCreate returns warnings for the creation of the given object.
func (genericStrategy) WarningsOnCreate(ctx context.Context, obj runtime.Object) []string { return nil }

func (genericStrategy) AllowCreateOnUpdate() bool {
	return true
}

func (genericStrategy) AllowUnconditionalUpdate() bool {
	return true
}

func (genericStrategy) Canonicalize(obj runtime.Object) {}

func (genericStrategy) ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnUpdate returns warnings for the given update.
func (genericStrategy) WarningsOnUpdate(ctx context.Context, obj, old runtime.Object) []string {
	return nil
}

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
