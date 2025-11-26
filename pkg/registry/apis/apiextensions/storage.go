package apiextensions

import (
	"context"
	"fmt"

	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericregistry "k8s.io/apiserver/pkg/registry/generic/registry"
	"k8s.io/apiserver/pkg/registry/rest"
)

var _ rest.StandardStorage = (*crdStorage)(nil)
var _ rest.Scoper = (*crdStorage)(nil)

// crdStorage wraps the generic registry store and adds CRD-specific validation and dynamic registration
type crdStorage struct {
	*genericregistry.Store
	dynamicReg *DynamicRegistry
}

// NamespaceScoped returns false since CRDs are cluster-scoped resources
func (s *crdStorage) NamespaceScoped() bool {
	return false
}

// Create validates and creates a CRD, then triggers dynamic registration of the custom resource
func (s *crdStorage) Create(
	ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	crd, ok := obj.(*apiextensionsv1.CustomResourceDefinition)
	if !ok {
		return nil, apierrors.NewBadRequest("object is not a CustomResourceDefinition")
	}

	if err := validateCRDForPhase1(crd); err != nil {
		return nil, err
	}

	// Create the CRD in storage
	result, err := s.Store.Create(ctx, obj, createValidation, options)
	if err != nil {
		return nil, err
	}

	// Register the custom resource dynamically
	createdCRD, ok := result.(*apiextensionsv1.CustomResourceDefinition)
	if ok {
		if err := s.dynamicReg.RegisterCRD(createdCRD); err != nil {
			// Log error but don't fail the creation
			// TODO: Add proper logging
			fmt.Printf("Warning: failed to register CRD dynamically: %v\n", err)
		}
	}

	return result, nil
}

// Update validates and updates a CRD, then updates the dynamic registration
func (s *crdStorage) Update(
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	result, created, err := s.Store.Update(ctx, name, objInfo, createValidation, updateValidation, forceAllowCreate, options)
	if err != nil {
		return nil, false, err
	}

	// Update dynamic registration
	updatedCRD, ok := result.(*apiextensionsv1.CustomResourceDefinition)
	if ok {
		if err := s.dynamicReg.UpdateCRD(updatedCRD); err != nil {
			fmt.Printf("Warning: failed to update CRD registration: %v\n", err)
		}
	}

	return result, created, nil
}

// Delete deletes a CRD and unregisters the custom resource
func (s *crdStorage) Delete(
	ctx context.Context,
	name string,
	deleteValidation rest.ValidateObjectFunc,
	options *metav1.DeleteOptions,
) (runtime.Object, bool, error) {
	// Get the CRD before deletion
	obj, err := s.Store.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	crd, ok := obj.(*apiextensionsv1.CustomResourceDefinition)
	if !ok {
		return nil, false, apierrors.NewInternalError(fmt.Errorf("object is not a CRD"))
	}

	// Delete the CRD
	result, immediate, err := s.Store.Delete(ctx, name, deleteValidation, options)
	if err != nil {
		return nil, false, err
	}

	// Unregister the custom resource
	if err := s.dynamicReg.UnregisterCRD(crd); err != nil {
		fmt.Printf("Warning: failed to unregister CRD: %v\n", err)
	}

	return result, immediate, nil
}

func validateCRDForPhase1(crd *apiextensionsv1.CustomResourceDefinition) error {
	// TODO(@konsalex): only support single-version CRDs for now
	if len(crd.Spec.Versions) != 1 {
		return apierrors.NewBadRequest(
			fmt.Sprintf("we only support single-version CRDs, got %d versions", len(crd.Spec.Versions)),
		)
	}

	// TODO(@konsalex): no webhook conversion for now we will need to support this
	if crd.Spec.Conversion != nil && crd.Spec.Conversion.Strategy == apiextensionsv1.WebhookConverter {
		return apierrors.NewBadRequest("no support webhook conversion")
	}

	// Ensure the single version is marked as both served and storage
	if len(crd.Spec.Versions) > 0 {
		version := crd.Spec.Versions[0]
		if !version.Served {
			return apierrors.NewBadRequest("the single version must be marked as served")
		}
		if !version.Storage {
			return apierrors.NewBadRequest("the single version must be marked as storage")
		}
	}

	return nil
}

// crdStatusStorage handles the status subresource for CRDs
type crdStatusStorage struct {
	*genericregistry.Store
}

func (s *crdStatusStorage) New() runtime.Object {
	return &apiextensionsv1.CustomResourceDefinition{}
}

func (s *crdStatusStorage) Get(
	ctx context.Context,
	name string,
	options *metav1.GetOptions,
) (runtime.Object, error) {
	return s.Store.Get(ctx, name, options)
}

func (s *crdStatusStorage) Update(
	ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	return s.Store.Update(ctx, name, objInfo, createValidation, updateValidation, false, options)
}
