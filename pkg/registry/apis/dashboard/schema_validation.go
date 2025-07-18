package dashboard

import (
	"context"
	_ "embed"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	v0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	v1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	v2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// ValidateDashboardSpec validates the dashboard spec and throws a detailed error if there are validation errors.
func (b *DashboardsAPIBuilder) ValidateDashboardSpec(ctx context.Context, obj runtime.Object, fieldValidationMode string) (field.ErrorList, error) {
	accessor, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, fmt.Errorf("error getting meta accessor: %w", err)
	}

	errorOnSchemaMismatches := false
	mode := fieldValidationMode
	if mode != metav1.FieldValidationIgnore {
		switch obj.(type) {
		case *v0.Dashboard:
			errorOnSchemaMismatches = false // Never error for v0
		case *v1.Dashboard:
			errorOnSchemaMismatches = !b.features.IsEnabled(ctx, featuremgmt.FlagDashboardDisableSchemaValidationV1)
		case *v2.Dashboard:
			errorOnSchemaMismatches = !b.features.IsEnabled(ctx, featuremgmt.FlagDashboardDisableSchemaValidationV2)
		default:
			return nil, fmt.Errorf("invalid dashboard type: %T", obj)
		}
	}
	if mode == metav1.FieldValidationWarn {
		return nil, apierrors.NewBadRequest("Not supported: FieldValidationMode: Warn")
	}

	alwaysLogSchemaValidationErrors := b.features.IsEnabled(ctx, featuremgmt.FlagDashboardSchemaValidationLogging)

	var errors field.ErrorList
	var schemaVersionError field.ErrorList
	if errorOnSchemaMismatches || alwaysLogSchemaValidationErrors {
		switch v := obj.(type) {
		case *v0.Dashboard:
			errors, schemaVersionError = v0.ValidateDashboardSpec(v, alwaysLogSchemaValidationErrors)
		case *v1.Dashboard:
			errors, schemaVersionError = v1.ValidateDashboardSpec(v, alwaysLogSchemaValidationErrors)
		case *v2.Dashboard:
			errors = v2.ValidateDashboardSpec(v)
		}
	}

	if alwaysLogSchemaValidationErrors && len(errors) > 0 {
		b.log.Info("Schema validation errors during dashboard validation", "group_version", obj.GetObjectKind().GroupVersionKind().GroupVersion().String(), "name", accessor.GetName(), "errors", errors.ToAggregate().Error(), "schema_version_mismatch", schemaVersionError != nil)
	}

	if errorOnSchemaMismatches {
		if schemaVersionError != nil {
			return schemaVersionError, nil
		}
		if len(errors) > 0 {
			return errors, nil
		}
	}
	return nil, nil
}
