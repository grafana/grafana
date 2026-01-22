package connection

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// DeleteValidator is the interface for connection delete validation.
// It validates that a connection can be safely deleted.
type DeleteValidator interface {
	ValidateDelete(ctx context.Context, namespace, name string) field.ErrorList
}

// AdmissionValidator handles validation for Connection resources during admission.
//
// Validation during admission is limited to structural checks that do not require
// decrypting secrets or calling external services (e.g., GitHub API). This ensures
// fast, synchronous validation without side effects.
//
// For runtime validation that requires secrets or external service checks, use the
// Test() method on the Connection interface instead.
type AdmissionValidator struct {
	factory          Factory
	deleteValidators []DeleteValidator
}

// NewAdmissionValidator creates a new connection admission validator.
// deleteValidators are called for delete operations in order; the first error stops validation.
func NewAdmissionValidator(factory Factory, deleteValidators ...DeleteValidator) *AdmissionValidator {
	return &AdmissionValidator{
		factory:          factory,
		deleteValidators: deleteValidators,
	}
}

// Validate validates Connection resources during admission
func (v *AdmissionValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()

	// Handle delete operations - obj may be nil for delete
	if a.GetOperation() == admission.Delete {
		return v.validateDelete(ctx, a)
	}

	if obj == nil {
		return nil
	}

	// Do not validate objects we are trying to delete
	meta, _ := utils.MetaAccessor(obj)
	if meta.GetDeletionTimestamp() != nil {
		return nil
	}

	c, ok := obj.(*provisioning.Connection)
	if !ok {
		return fmt.Errorf("expected connection configuration, got %T", obj)
	}

	// Copy previous values if they exist
	if a.GetOldObject() != nil {
		if oldConn, ok := a.GetOldObject().(*provisioning.Connection); ok {
			CopySecureValues(c, oldConn)
		}
	}

	// Structural validation without decryption
	if list := v.factory.Validate(ctx, c); len(list) > 0 {
		return apierrors.NewInvalid(
			provisioning.ConnectionResourceInfo.GroupVersionKind().GroupKind(),
			c.GetName(), list)
	}

	return nil
}

// validateDelete runs delete validators for the connection
func (v *AdmissionValidator) validateDelete(ctx context.Context, a admission.Attributes) error {
	name := a.GetName()
	if name == "" {
		return nil
	}

	namespace := a.GetNamespace()

	for _, validator := range v.deleteValidators {
		if list := validator.ValidateDelete(ctx, namespace, name); len(list) > 0 {
			return apierrors.NewInvalid(
				provisioning.ConnectionResourceInfo.GroupVersionKind().GroupKind(),
				name, list)
		}
	}

	return nil
}
