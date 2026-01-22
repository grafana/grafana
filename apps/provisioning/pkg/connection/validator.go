package connection

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/admission"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// AdmissionValidator handles validation for Connection resources during admission.
//
// Validation during admission is limited to structural checks that do not require
// decrypting secrets or calling external services (e.g., GitHub API). This ensures
// fast, synchronous validation without side effects.
//
// For runtime validation that requires secrets or external service checks, use the
// Test() method on the Connection interface instead.
type AdmissionValidator struct {
	factory Factory
}

// NewAdmissionValidator creates a new connection admission validator
func NewAdmissionValidator(factory Factory) *AdmissionValidator {
	return &AdmissionValidator{
		factory: factory,
	}
}

// Validate validates Connection resources during admission
func (v *AdmissionValidator) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	obj := a.GetObject()
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
