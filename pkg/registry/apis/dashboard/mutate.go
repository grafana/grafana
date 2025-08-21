package dashboard

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashboardV2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func (b *DashboardsAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	op := a.GetOperation()

	// Mutate removes any internal ID set in the spec & adds it as a label
	if op != admission.Create && op != admission.Update {
		return nil
	}
	var internalID int64
	obj := a.GetObject()
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}

	var migrationErr error
	var resourceInfo utils.ResourceInfo
	switch v := obj.(type) {
	case *dashboardV0.Dashboard:
		delete(v.Spec.Object, "uid")
		delete(v.Spec.Object, "version")
		if id, ok := v.Spec.Object["id"].(float64); ok {
			delete(v.Spec.Object, "id")
			internalID = int64(id)
		}
		resourceInfo = dashboardV0.DashboardResourceInfo
	case *dashboardV1.Dashboard:
		delete(v.Spec.Object, "uid")
		delete(v.Spec.Object, "version")
		if id, ok := v.Spec.Object["id"].(float64); ok {
			delete(v.Spec.Object, "id")
			internalID = int64(id)
		}
		resourceInfo = dashboardV1.DashboardResourceInfo
		migrationErr = migration.Migrate(v.Spec.Object, schemaversion.LATEST_VERSION)
		if migrationErr != nil {
			v.Status.Conversion = &dashboardV1.DashboardConversionStatus{
				Failed: true,
				Error:  migrationErr.Error(),
			}
		}
	case *dashboardV2.Dashboard:
		// Temporary fix: The generator fails to properly initialize this property, so we'll do it here
		// until the generator is fixed.
		if v.Spec.Layout.GridLayoutKind == nil && v.Spec.Layout.RowsLayoutKind == nil && v.Spec.Layout.AutoGridLayoutKind == nil && v.Spec.Layout.TabsLayoutKind == nil {
			v.Spec.Layout.GridLayoutKind = &dashboardV2.DashboardGridLayoutKind{
				Kind: "GridLayout",
				Spec: dashboardV2.DashboardGridLayoutSpec{},
			}
		}

		resourceInfo = dashboardV2.DashboardResourceInfo

		// Noop for V2
	case *dashboardV0.LibraryPanel:
		// no mutation for library panels
		return nil
	default:
		return fmt.Errorf("mutation error: expected to dashboard, got %T", obj)
	}

	if internalID != 0 {
		meta.SetDeprecatedInternalID(internalID) // nolint:staticcheck
	}

	fieldValidationMode := getFieldValidationMode(a)

	var validationErrorList field.ErrorList
	var validationProcessingError error
	if migrationErr == nil {
		// Migration check passed, validate the spec now - this will respect the field validation mode!
		validationErrorList, validationProcessingError = b.ValidateDashboardSpec(ctx, obj, fieldValidationMode)
	}

	// Only fail if the field validation mode is strict
	if fieldValidationMode == metav1.FieldValidationStrict {
		if migrationErr != nil {
			return apierrors.NewInvalid(resourceInfo.GroupVersionKind().GroupKind(), meta.GetName(), field.ErrorList{
				field.Invalid(field.NewPath("spec"), meta.GetName(), migrationErr.Error())})
		}
		if validationProcessingError != nil {
			return validationProcessingError
		}
		if len(validationErrorList) > 0 {
			return apierrors.NewInvalid(resourceInfo.GroupVersionKind().GroupKind(), meta.GetName(), validationErrorList)
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
