package dashboard

import (
	"context"
	_ "embed"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ValidateDashboardSpec validates the dashboard spec and throws a detailed error if there are validation errors.
func (b *DashboardsAPIBuilder) ValidateDashboardSpec(ctx context.Context, obj runtime.Object, a admission.Attributes) error {
	// This will be removed with the other PR
	return nil

	accessor, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("error getting meta accessor: %w", err)
	}
	errorOnSchemaMismatches := true
	switch mode := getFieldValidationMode(a); mode {
	case metav1.FieldValidationIgnore:
		errorOnSchemaMismatches = false
	case metav1.FieldValidationWarn:
		return apierrors.NewBadRequest("FieldValidationWarn is not supported")
	case metav1.FieldValidationStrict:
		break
	default:
		return apierrors.NewBadRequest(fmt.Sprintf("Invalid field validation mode: %s", mode))
	}
	if errorOnSchemaMismatches {
		if _, ok := obj.(*v1alpha1.Dashboard); ok {
			errorOnSchemaMismatches = !b.features.IsEnabled(ctx, featuremgmt.FlagDashboardDisableSchemaValidationV1)
		} else if _, ok := obj.(*v2alpha1.Dashboard); ok {
			errorOnSchemaMismatches = !b.features.IsEnabled(ctx, featuremgmt.FlagDashboardDisableSchemaValidationV2)
		}
	}

	alwaysLogSchemaValidationErrors := b.features.IsEnabled(ctx, featuremgmt.FlagDashboardSchemaValidationLogging)

	var errors field.ErrorList
	var schemaVersionError *field.Error
	if errorOnSchemaMismatches || alwaysLogSchemaValidationErrors {
		switch v := obj.(type) {
		case *v0alpha1.Dashboard:
			// We re-use the v1 validation so we can gather data - these will never error out.
			errors, schemaVersionError = v1alpha1.ValidateDashboardSpec(&v.Spec, alwaysLogSchemaValidationErrors)
			errorOnSchemaMismatches = false // Never error for v0
		case *v1alpha1.Dashboard:
			errors, schemaVersionError = v1alpha1.ValidateDashboardSpec(&v.Spec, alwaysLogSchemaValidationErrors)
		case *v2alpha1.Dashboard:
			errors = v2alpha1.ValidateDashboardSpec(v)
		}
	}

	if alwaysLogSchemaValidationErrors && len(errors) > 0 {
		b.log.Info("Schema validation errors during dashboard validation", "group_version", obj.GetObjectKind().GroupVersionKind().GroupVersion().String(), "name", accessor.GetName(), "errors", errors.ToAggregate().Error(), "schema_version_mismatch", schemaVersionError != nil)
	}

	if errorOnSchemaMismatches {
		if schemaVersionError != nil {
			return schemaVersionError
		}
		if len(errors) > 0 {
			return apierrors.NewInvalid(a.GetKind().GroupKind(), accessor.GetName(), errors)
		}
	}
	return nil
}

func getFieldValidationMode(a admission.Attributes) string {
	var validation string
	switch opts := a.GetOperationOptions().(type) {
	case *metav1.CreateOptions:
		validation = opts.FieldValidation
	case *metav1.UpdateOptions:
		validation = opts.FieldValidation
	default:
		validation = metav1.FieldValidationStrict
	}

	if validation == "" {
		validation = metav1.FieldValidationStrict
	}

	return validation
}
