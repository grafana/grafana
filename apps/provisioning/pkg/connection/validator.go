package connection

import (
	"context"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
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
	// AdmissionValidator is only for CREATE and UPDATE operations
	if a.GetOperation() == admission.Delete {
		return nil
	}

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

	// If dryRun, also run runtime validation (external systems, internal state)
	// This allows full validation without persisting the resource
	if a.IsDryRun() {
		return v.validateRuntime(ctx, c) // Return errors immediately - resource won't be created
	}

	return nil
}

// validateRuntime performs runtime validation by building the connection and testing it
// This checks external systems (e.g., GitHub API) to validate appID and installationID
func (v *AdmissionValidator) validateRuntime(ctx context.Context, conn *provisioning.Connection) error {
	// Build the connection to get a Connection interface
	connection, err := v.factory.Build(ctx, conn)
	if err != nil {
		// If build fails, return an error (this might happen if secrets are invalid)
		return apierrors.NewInvalid(
			provisioning.ConnectionResourceInfo.GroupVersionKind().GroupKind(),
			conn.GetName(),
			field.ErrorList{
				field.Invalid(
					field.NewPath(""),
					"",
					fmt.Sprintf("failed to build connection: %v", err),
				),
			},
		)
	}

	// Run runtime validation via Test() method
	testResults, err := connection.Test(ctx)
	if err != nil {
		return apierrors.NewInternalError(fmt.Errorf("failed to test connection: %w", err))
	}

	// If test failed, convert TestResults.Errors to field.ErrorList
	if !testResults.Success && len(testResults.Errors) > 0 {
		var list field.ErrorList
		for _, testError := range testResults.Errors {
			fieldPath := field.NewPath("")
			if testError.Field != "" {
				// Convert dot-separated path to field.Path
				parts := strings.Split(testError.Field, ".")
				fieldPath = field.NewPath(parts[0])
				for _, part := range parts[1:] {
					fieldPath = fieldPath.Child(part)
				}
			}
			var badValue any = ""
			if testError.BadValue != nil {
				badValue = testError.BadValue
			}
			list = append(list, field.Invalid(
				fieldPath,
				badValue,
				testError.Detail,
			))
		}
		return apierrors.NewInvalid(
			provisioning.ConnectionResourceInfo.GroupVersionKind().GroupKind(),
			conn.GetName(),
			list,
		)
	}

	return nil
}
