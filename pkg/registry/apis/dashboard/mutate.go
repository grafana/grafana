package dashboard

import (
	"context"
	"encoding/json"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/utils/ptr"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashboardV2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/util"
)

func (b *DashboardsAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	op := a.GetOperation()

	// Mutate removes any internal ID set in the spec & adds it as a label
	if op != admission.Create && op != admission.Update {
		return nil
	}

	switch a.GetResource().Resource {
	case dashboardV0.DASHBOARD_RESOURCE:
		return b.mutateDashboard(ctx, a)

	case dashboardV0.LIBRARY_PANEL_RESOURCE:
		return nil // nothing needed
	case dashboardV0.SNAPSHOT_RESOURCE:
		return nil
	}

	return fmt.Errorf("unexpected resource: %+v", a.GetResource())
}

func (b *DashboardsAPIBuilder) mutateDashboard(ctx context.Context, a admission.Attributes) (err error) {
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
		// Strip BOMs from all string values in the dashboard spec
		v.Spec.Object = util.StripBOMFromInterface(v.Spec.Object).(map[string]any)
		resourceInfo = dashboardV0.DashboardResourceInfo

	case *dashboardV1.Dashboard:
		delete(v.Spec.Object, "uid")
		delete(v.Spec.Object, "version")
		if id, ok := v.Spec.Object["id"].(float64); ok {
			delete(v.Spec.Object, "id")
			internalID = int64(id)
		}
		// Strip BOMs from all string values in the dashboard spec
		v.Spec.Object = util.StripBOMFromInterface(v.Spec.Object).(map[string]any)
		resourceInfo = dashboardV1.DashboardResourceInfo
		migrationErr = migration.Migrate(ctx, v.Spec.Object, schemaversion.LATEST_VERSION)
		if migrationErr != nil {
			v.Status.Conversion = &dashboardV1.DashboardConversionStatus{
				Failed: true,
				Error:  ptr.To(migrationErr.Error()),
			}
		}

	case *dashboardV2alpha1.Dashboard:
		// Temporary fix: The generator fails to properly initialize this property, so we'll do it here
		// until the generator is fixed.
		if v.Spec.Layout.GridLayoutKind == nil && v.Spec.Layout.RowsLayoutKind == nil && v.Spec.Layout.AutoGridLayoutKind == nil && v.Spec.Layout.TabsLayoutKind == nil {
			v.Spec.Layout.GridLayoutKind = &dashboardV2alpha1.DashboardGridLayoutKind{
				Kind: "GridLayout",
				Spec: dashboardV2alpha1.DashboardGridLayoutSpec{},
			}
		}
		if err := b.stripBOMIfEnabled(&v.Spec, "v2alpha1"); err != nil {
			return err
		}
		resourceInfo = dashboardV2alpha1.DashboardResourceInfo

	case *dashboardV2beta1.Dashboard:
		// Temporary fix: The generator fails to properly initialize this property, so we'll do it here
		// until the generator is fixed.
		if v.Spec.Layout.GridLayoutKind == nil && v.Spec.Layout.RowsLayoutKind == nil && v.Spec.Layout.AutoGridLayoutKind == nil && v.Spec.Layout.TabsLayoutKind == nil {
			v.Spec.Layout.GridLayoutKind = &dashboardV2beta1.DashboardGridLayoutKind{
				Kind: "GridLayout",
				Spec: dashboardV2beta1.DashboardGridLayoutSpec{},
			}
		}
		if err := b.stripBOMIfEnabled(&v.Spec, "v2beta1"); err != nil {
			return err
		}
		resourceInfo = dashboardV2beta1.DashboardResourceInfo

	case *dashboardV2.Dashboard:
		if v.Spec.Layout.GridLayoutKind == nil && v.Spec.Layout.RowsLayoutKind == nil && v.Spec.Layout.AutoGridLayoutKind == nil && v.Spec.Layout.TabsLayoutKind == nil {
			v.Spec.Layout.GridLayoutKind = &dashboardV2.DashboardGridLayoutKind{
				Kind: "GridLayout",
				Spec: dashboardV2.DashboardGridLayoutSpec{},
			}
		}
		if err := b.stripBOMIfEnabled(&v.Spec, "v2"); err != nil {
			return err
		}
		resourceInfo = dashboardV2.DashboardResourceInfo

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

// stripBOMIfEnabled conditionally strips BOMs from v2 dashboard specs based on skipBOMStripping flag.
func (b *DashboardsAPIBuilder) stripBOMIfEnabled(spec interface{}, version string) error {
	if !b.skipBOMStripping {
		if err := stripBOMFromV2Spec(spec); err != nil {
			return fmt.Errorf("failed to strip BOMs from %s dashboard: %w", version, err)
		}
	}
	return nil
}

// stripBOMFromV2Spec strips BOMs from all string fields in a v2 dashboard spec
// using reflection to avoid JSON marshal/unmarshal overhead.
func stripBOMFromV2Spec(spec interface{}) error {
	util.StripBOMFromStruct(spec)
	return nil
}

// stripBOMFromV2SpecJSON is the old JSON-based implementation kept for comparison/benchmarking.
// It strips BOMs from all string fields in a v2 dashboard spec
// by converting to unstructured, cleaning, and converting back.
func stripBOMFromV2SpecJSON(spec interface{}) error {
	// Convert spec to unstructured (map[string]any) via JSON
	specBytes, err := json.Marshal(spec)
	if err != nil {
		return fmt.Errorf("failed to marshal spec: %w", err)
	}

	var unstructuredSpec map[string]any
	if err := json.Unmarshal(specBytes, &unstructuredSpec); err != nil {
		return fmt.Errorf("failed to unmarshal spec: %w", err)
	}

	// Strip BOMs from all strings recursively
	cleanedSpec := util.StripBOMFromInterface(unstructuredSpec).(map[string]any)

	// Convert back to typed struct
	cleanedBytes, err := json.Marshal(cleanedSpec)
	if err != nil {
		return fmt.Errorf("failed to marshal cleaned spec: %w", err)
	}

	if err := json.Unmarshal(cleanedBytes, spec); err != nil {
		return fmt.Errorf("failed to unmarshal cleaned spec: %w", err)
	}

	return nil
}
