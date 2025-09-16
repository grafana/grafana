// SPDX-License-Identifier: AGPL-3.0-only
// Provenance-includes-location: https://github.com/kubernetes/kube-aggregator/blob/master/pkg/registry/apiservice/strategy.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Kubernetes Authors.

package dataplaneservice

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/names"

	"github.com/grafana/grafana/pkg/aggregator/apis/aggregation"
	"sigs.k8s.io/structured-merge-diff/v4/fieldpath"
)

type dataPlaneServiceStrategy struct {
	runtime.ObjectTyper
	names.NameGenerator
}

// dataPlaneServiceStrategy must implement rest.RESTCreateUpdateStrategy
var _ rest.RESTCreateUpdateStrategy = dataPlaneServiceStrategy{}
var Strategy = dataPlaneServiceStrategy{}

// NewStrategy creates a new dataPlaneServiceStrategy.
func NewStrategy(typer runtime.ObjectTyper) rest.CreateUpdateResetFieldsStrategy {
	return dataPlaneServiceStrategy{typer, names.SimpleNameGenerator}
}

func (dataPlaneServiceStrategy) NamespaceScoped() bool {
	return false
}

func (dataPlaneServiceStrategy) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	fields := map[fieldpath.APIVersion]*fieldpath.Set{
		"aggregation.grafana.app/v0alpha1": fieldpath.NewSet(
			fieldpath.MakePathOrDie("status"),
		),
	}

	return fields
}

func (dataPlaneServiceStrategy) PrepareForCreate(ctx context.Context, obj runtime.Object) {
}

func (dataPlaneServiceStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	newDataPlaneService := obj.(*aggregation.DataPlaneService)
	oldDataPlaneService := old.(*aggregation.DataPlaneService)
	newDataPlaneService.Status = oldDataPlaneService.Status
}

func (dataPlaneServiceStrategy) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnCreate returns warnings for the creation of the given object.
func (dataPlaneServiceStrategy) WarningsOnCreate(ctx context.Context, obj runtime.Object) []string {
	return nil
}

func (dataPlaneServiceStrategy) AllowCreateOnUpdate() bool {
	return false
}

func (dataPlaneServiceStrategy) AllowUnconditionalUpdate() bool {
	return false
}

func (dataPlaneServiceStrategy) Canonicalize(obj runtime.Object) {
}

func (dataPlaneServiceStrategy) ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnUpdate returns warnings for the given update.
func (dataPlaneServiceStrategy) WarningsOnUpdate(ctx context.Context, obj, old runtime.Object) []string {
	return nil
}

type dataPlaneServiceStatusStrategy struct {
	runtime.ObjectTyper
	names.NameGenerator
}

// NewStatusStrategy creates a new dataPlaneServiceStatusStrategy.
func NewStatusStrategy(typer runtime.ObjectTyper) rest.UpdateResetFieldsStrategy {
	return dataPlaneServiceStatusStrategy{typer, names.SimpleNameGenerator}
}

func (dataPlaneServiceStatusStrategy) NamespaceScoped() bool {
	return false
}

func (dataPlaneServiceStatusStrategy) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	fields := map[fieldpath.APIVersion]*fieldpath.Set{
		"aggregation.grafana.app/v0alpha1": fieldpath.NewSet(
			fieldpath.MakePathOrDie("spec"),
			fieldpath.MakePathOrDie("metadata"),
		),
	}

	return fields
}

func (dataPlaneServiceStatusStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	newDataPlaneService := obj.(*aggregation.DataPlaneService)
	oldDataPlaneService := old.(*aggregation.DataPlaneService)
	newDataPlaneService.Spec = oldDataPlaneService.Spec
	newDataPlaneService.Labels = oldDataPlaneService.Labels
	newDataPlaneService.Annotations = oldDataPlaneService.Annotations
	newDataPlaneService.Finalizers = oldDataPlaneService.Finalizers
	newDataPlaneService.OwnerReferences = oldDataPlaneService.OwnerReferences
}

func (dataPlaneServiceStatusStrategy) AllowCreateOnUpdate() bool {
	return false
}

func (dataPlaneServiceStatusStrategy) AllowUnconditionalUpdate() bool {
	return false
}

// Canonicalize normalizes the object after validation.
func (dataPlaneServiceStatusStrategy) Canonicalize(obj runtime.Object) {
}

// ValidateUpdate validates an update of dataPlaneServiceStatusStrategy.
func (dataPlaneServiceStatusStrategy) ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnUpdate returns warnings for the given update.
func (dataPlaneServiceStatusStrategy) WarningsOnUpdate(ctx context.Context, obj, old runtime.Object) []string {
	return nil
}

// GetAttrs returns the labels and fields of an API server for filtering purposes.
func GetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	s, ok := obj.(*aggregation.DataPlaneService)
	if !ok {
		return nil, nil, fmt.Errorf("given object is not a DataPlaneService")
	}
	return labels.Set(s.Labels), ToSelectableFields(s), nil
}

// MatchDataPlaneService is the filter used by the generic etcd backend to watch events
// from etcd to clients of the apiserver only interested in specific labels/fields.
func MatchDataPlaneService(label labels.Selector, field fields.Selector) storage.SelectionPredicate {
	return storage.SelectionPredicate{
		Label:    label,
		Field:    field,
		GetAttrs: GetAttrs,
	}
}

// ToSelectableFields returns a field set that represents the object.
func ToSelectableFields(obj *aggregation.DataPlaneService) fields.Set {
	return generic.ObjectMetaFieldsSet(&obj.ObjectMeta, true)
}
