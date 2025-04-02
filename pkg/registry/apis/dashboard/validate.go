package dashboard

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	dashboardkind "github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

// Validate will prevent deletion of provisioned dashboards, unless the grace period is set to 0, indicating a force deletion
func (b *DashboardsAPIBuilder) Validate(
	ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces,
) error {
	op := a.GetOperation()

	if op == admission.Create || op == admission.Update {
		if err := ValidateDashboardSpec(ctx, a); err != nil {
			return err
		}
	}

	if op == admission.Delete {
		obj := a.GetOperationOptions()
		deleteOptions, ok := obj.(*metav1.DeleteOptions)
		if !ok {
			return fmt.Errorf("expected v1.DeleteOptions")
		}

		if deleteOptions.GracePeriodSeconds == nil || *deleteOptions.GracePeriodSeconds != 0 {
			nsInfo, err := claims.ParseNamespace(a.GetNamespace())
			if err != nil {
				return fmt.Errorf("%v: %w", "failed to parse namespace", err)
			}

			provisioningData, err := b.dashboardProvisioningService.GetProvisionedDashboardDataByDashboardUID(ctx, nsInfo.OrgID, a.GetName())
			if err != nil {
				if errors.Is(err, dashboards.ErrProvisionedDashboardNotFound) ||
					errors.Is(err, dashboards.ErrDashboardNotFound) ||
					apierrors.IsNotFound(err) {
					return nil
				}

				return fmt.Errorf("%v: %w", "delete hook failed to check if dashboard is provisioned", err)
			}

			if provisioningData != nil {
				return apierrors.NewBadRequest(dashboards.ErrDashboardCannotDeleteProvisionedDashboard.Reason)
			}
		}
	}

	return nil
}

// ValidateDashboardSpec validates the dashboard spec.
func ValidateDashboardSpec(ctx context.Context, a admission.Attributes) error {
	obj := a.GetObject()

	validation := getValidation(a)

	if validation == metav1.FieldValidationIgnore {
		// We don't want to validate the dashboard spec if the validation is set to ignore.
		return nil
	}

	if validation == metav1.FieldValidationWarn {
		// TODO: not sure how to return warnings
		return nil
	}

	var errs field.ErrorList
	switch v := obj.(type) {
	case *v0alpha1.Dashboard:
		errs = dashboardkind.ValidateDashboardSpec(ctx, v.Spec)
	case *v1alpha1.Dashboard:
		errs = dashboardkind.ValidateDashboardSpec(ctx, v.Spec)
	}

	if len(errs) > 0 {
		return apierrors.NewInvalid(a.GetKind().GroupKind(), a.GetName(), errs)
	}

	return nil
}

func getValidation(a admission.Attributes) string {
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
