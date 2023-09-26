package generic

import (
	"context"

	"k8s.io/apimachinery/pkg/api/meta"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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

// NewStrategy creates and returns a genericStrategy instance
func NewStrategy(typer runtime.ObjectTyper) genericStrategy {
	return genericStrategy{typer, names.SimpleNameGenerator}
}

func (genericStrategy) NamespaceScoped() bool {
	return true
}

func (genericStrategy) PrepareForCreate(ctx context.Context, obj runtime.Object) {
}

func (genericStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
}

func (genericStrategy) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnCreate returns warnings for the creation of the given object.
func (genericStrategy) WarningsOnCreate(ctx context.Context, obj runtime.Object) []string { return nil }

func (genericStrategy) AllowCreateOnUpdate() bool {
	return false
}

func (genericStrategy) AllowUnconditionalUpdate() bool {
	return false
}

func (genericStrategy) Canonicalize(obj runtime.Object) {
}

func (genericStrategy) ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnUpdate returns warnings for the given update.
func (genericStrategy) WarningsOnUpdate(ctx context.Context, obj, old runtime.Object) []string {
	return nil
}

func GetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	accessor, err := meta.Accessor(obj)
	if err != nil {
		return nil, nil, err
	}
	return labels.Set(accessor.GetLabels()), objectMetaFieldsSet(accessor, false), nil
}

// objectMetaFieldsSet returns a fields that represent the ObjectMeta.
func objectMetaFieldsSet(objectMeta metav1.Object, namespaceScoped bool) fields.Set {
	if namespaceScoped {
		return fields.Set{
			"metadata.name":      objectMeta.GetName(),
			"metadata.namespace": objectMeta.GetNamespace(),
		}
	}
	return fields.Set{
		"metadata.name": objectMeta.GetName(),
	}
}

func Matcher(label labels.Selector, field fields.Selector) storage.SelectionPredicate {
	return storage.SelectionPredicate{
		Label:    label,
		Field:    field,
		GetAttrs: GetAttrs,
	}
}
