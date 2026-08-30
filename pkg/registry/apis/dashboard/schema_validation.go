package dashboard

import (
	"context"
	_ "embed"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	v0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	v1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	v2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	v2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	v2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
)

// ValidateDashboardSpec validates the dashboard spec and throws a detailed error if there are validation errors.
func (b *DashboardsAPIBuilder) ValidateDashboardSpec(ctx context.Context, obj runtime.Object, fieldValidationMode string) (field.ErrorList, error) {
	errorOnSchemaMismatches := false
	mode := fieldValidationMode
	if mode != metav1.FieldValidationIgnore {
		switch obj.(type) {
		case *v0.Dashboard:
			errorOnSchemaMismatches = false // Never error for v0
		default:
			errorOnSchemaMismatches = true
		}
	}
	if mode == metav1.FieldValidationWarn {
		return nil, apierrors.NewBadRequest("Not supported: FieldValidationMode: Warn")
	}

	var errors field.ErrorList
	var schemaVersionError field.ErrorList
	if errorOnSchemaMismatches {
		switch v := obj.(type) {
		case *v0.Dashboard:
			errors, schemaVersionError = v0.ValidateDashboardSpec(v, false)
		case *v1.Dashboard:
			errors, schemaVersionError = v1.ValidateDashboardSpec(v, false)
		case *v2alpha1.Dashboard:
			errors = v2alpha1.ValidateDashboardSpec(v)
		case *v2beta1.Dashboard:
			errors = v2beta1.ValidateDashboardSpec(v)
		case *v2.Dashboard:
			errors = v2.ValidateDashboardSpec(v)
		}
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
