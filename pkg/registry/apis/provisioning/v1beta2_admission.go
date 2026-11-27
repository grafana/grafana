package provisioning

import (
	"context"
	"slices"
	"sort"

	"github.com/grafana/grafana-app-sdk/resource"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v1beta2"
)

// v1beta2Admission runs the v0alpha1 mutators and validators on v1beta2 objects. Only the checks
// for what the conversion would otherwise lose are specific to v1beta2.
type v1beta2Admission struct {
	scheme *runtime.Scheme
	inner  interface {
		Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error
		Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error
	}
}

// Mutate converts the object to the storage version, mutates it there and converts the result
// back. The round trip also canonicalizes the object: optional zero values become nil and
// conditions are encoded like metav1.Condition, so what is stored reads back unchanged.
func (v *v1beta2Admission) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()
	if obj == nil || a.GetOperation() == admission.Connect {
		return nil
	}
	converted, err := v.toStorageAttributes(a)
	if err != nil {
		return err
	}
	if err := v.inner.Mutate(ctx, converted, o); err != nil {
		return err
	}
	if err := fromStorageVersion(v.scheme, converted.object, obj); err != nil {
		return apierrors.NewInternalError(err)
	}
	return nil
}

func (v *v1beta2Admission) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	if a.GetOperation() == admission.Connect {
		return nil
	}
	converted, err := v.toStorageAttributes(a)
	if err != nil {
		return err
	}
	return v.inner.Validate(ctx, converted, o)
}

func (v *v1beta2Admission) toStorageAttributes(a admission.Attributes) (*storageVersionAttributes, error) {
	converted := &storageVersionAttributes{Attributes: a}
	var err error
	if converted.object, err = v.toStorageVersion(a, a.GetObject()); err != nil {
		return nil, err
	}
	if converted.oldObject, err = v.toStorageVersion(a, a.GetOldObject()); err != nil {
		return nil, err
	}
	return converted, nil
}

// toStorageVersion rejects what the conversion can't represent with field errors before
// converting, so clients get a 422 naming the field rather than a conversion error.
func (v *v1beta2Admission) toStorageVersion(a admission.Attributes, obj runtime.Object) (runtime.Object, error) {
	if obj == nil {
		return nil, nil
	}
	if _, ok := v1beta2Kind(v.scheme, obj); !ok {
		return obj, nil
	}
	if errs := validateV1beta2Lossless(obj); len(errs) > 0 {
		return nil, apierrors.NewInvalid(a.GetKind().GroupKind(), a.GetName(), errs)
	}
	stored, err := toStorageVersion(v.scheme, obj)
	if err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}
	return stored, nil
}

func validateV1beta2Lossless(obj runtime.Object) field.ErrorList {
	conditionsPath := field.NewPath("status", "conditions")
	securePath := field.NewPath("secure")
	switch o := obj.(type) {
	case *v1beta2.Repository:
		return append(v1beta2.ValidateConditions(conditionsPath, o.Status.Conditions),
			validateSecureKeys(securePath, o.Secure, v1beta2.RepositorySecureKeys)...)
	case *v1beta2.Connection:
		return append(v1beta2.ValidateConditions(conditionsPath, o.Status.Conditions),
			validateSecureKeys(securePath, o.Secure, v1beta2.ConnectionSecureKeys)...)
	default:
		return nil
	}
}

func validateSecureKeys(path *field.Path, secure resource.InlineSecureValues, allowed []string) field.ErrorList {
	var errs field.ErrorList
	for key := range secure {
		if !slices.Contains(allowed, key) {
			errs = append(errs, field.NotSupported(path.Key(key), key, allowed))
		}
	}
	sort.Slice(errs, func(i, j int) bool { return errs[i].Field < errs[j].Field })
	return errs
}

// storageVersionAttributes are the request attributes with the objects in the storage version.
type storageVersionAttributes struct {
	admission.Attributes
	object, oldObject runtime.Object
}

func (a *storageVersionAttributes) GetObject() runtime.Object    { return a.object }
func (a *storageVersionAttributes) GetOldObject() runtime.Object { return a.oldObject }
