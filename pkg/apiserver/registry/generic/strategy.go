package generic

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apiequality "k8s.io/apimachinery/pkg/api/equality"
	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/names"
	"sigs.k8s.io/structured-merge-diff/v4/fieldpath"
)

type genericStrategy struct {
	runtime.ObjectTyper
	names.NameGenerator

	gv schema.GroupVersion
}

// NewStrategy creates and returns a genericStrategy instance.
func NewStrategy(typer runtime.ObjectTyper, gv schema.GroupVersion) *genericStrategy {
	return &genericStrategy{typer, names.SimpleNameGenerator, gv}
}

// NamespaceScoped returns true because all Generic resources must be within a namespace.
func (g *genericStrategy) NamespaceScoped() bool {
	return true
}

func (g *genericStrategy) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	fields := map[fieldpath.APIVersion]*fieldpath.Set{
		fieldpath.APIVersion(g.gv.String()): fieldpath.NewSet(
			fieldpath.MakePathOrDie("status"),
		),
	}
	return fields
}

func (g *genericStrategy) PrepareForCreate(ctx context.Context, obj runtime.Object) {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return
	}
	meta.SetGeneration(1)
	objCopy := obj.DeepCopyObject()
	err = runtime.SetZeroValue(objCopy)
	if err != nil {
		return
	}
	metaCopy, err := utils.MetaAccessor(objCopy)
	if err != nil {
		return
	}
	status, err := metaCopy.GetStatus()
	if err == nil {
		_ = meta.SetStatus(status)
	}
}

func (g *genericStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	oldMeta, err := utils.MetaAccessor(old)
	if err != nil {
		return
	}

	newMeta, err := utils.MetaAccessor(obj)
	if err != nil {
		return
	}

	// update shouldn't change the status
	status, err := oldMeta.GetStatus()
	if err != nil {
		_ = newMeta.SetStatus(nil)
	} else {
		_ = newMeta.SetStatus(status)
	}

	spec, err := newMeta.GetSpec()
	if err != nil {
		return
	}

	oldSpec, err := oldMeta.GetSpec()
	if err != nil {
		return
	}

	if !apiequality.Semantic.DeepEqual(spec, oldSpec) {
		newMeta.SetGeneration(oldMeta.GetGeneration() + 1)
	}
}

func (g *genericStrategy) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnCreate returns warnings for the creation of the given object.
func (g *genericStrategy) WarningsOnCreate(ctx context.Context, obj runtime.Object) []string {
	return nil
}

func (g *genericStrategy) AllowCreateOnUpdate() bool {
	return true
}

func (g *genericStrategy) AllowUnconditionalUpdate() bool {
	return true
}

func (g *genericStrategy) Canonicalize(obj runtime.Object) {}

func (g *genericStrategy) ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnUpdate returns warnings for the given update.
func (g *genericStrategy) WarningsOnUpdate(ctx context.Context, obj, old runtime.Object) []string {
	return nil
}

type genericStatusStrategy struct {
	runtime.ObjectTyper
	names.NameGenerator

	gv schema.GroupVersion
}

// NewStatusStrategy creates a new genericStatusStrategy.
func NewStatusStrategy(typer runtime.ObjectTyper, gv schema.GroupVersion) *genericStatusStrategy {
	return &genericStatusStrategy{typer, names.SimpleNameGenerator, gv}
}

func (g *genericStatusStrategy) NamespaceScoped() bool {
	return true
}

func (g *genericStatusStrategy) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	fields := map[fieldpath.APIVersion]*fieldpath.Set{
		fieldpath.APIVersion(g.gv.String()): fieldpath.NewSet(
			fieldpath.MakePathOrDie("spec"),
			fieldpath.MakePathOrDie("metadata"),
		),
	}

	return fields
}

func (g *genericStatusStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	oldMeta, err := utils.MetaAccessor(old)
	if err != nil {
		return
	}

	newMeta, err := utils.MetaAccessor(obj)
	if err != nil {
		return
	}
	newMeta.SetAnnotations(oldMeta.GetAnnotations())
	newMeta.SetLabels(oldMeta.GetLabels())
	newMeta.SetFinalizers(oldMeta.GetFinalizers())
	newMeta.SetOwnerReferences(oldMeta.GetOwnerReferences())
}

func (g *genericStatusStrategy) AllowCreateOnUpdate() bool {
	return false
}

func (g *genericStatusStrategy) AllowUnconditionalUpdate() bool {
	return false
}

// Canonicalize normalizes the object after validation.
func (g *genericStatusStrategy) Canonicalize(obj runtime.Object) {
}

// ValidateUpdate validates an update of genericStatusStrategy.
func (g *genericStatusStrategy) ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnUpdate returns warnings for the given update.
func (g *genericStatusStrategy) WarningsOnUpdate(ctx context.Context, obj, old runtime.Object) []string {
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
