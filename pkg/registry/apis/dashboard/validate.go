package dashboard

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	dashboardkind "github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/quota"
)

// Validate will prevent deletion of provisioned dashboards, unless the grace period is set to 0, indicating a force deletion
func (b *DashboardsAPIBuilder) Validate(
	ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces,
) error {
	op := a.GetOperation()

	// Handle different operations
	switch op {
	case admission.Delete:
		return b.validateDelete(ctx, a)
	case admission.Create:
		return b.validateCreate(ctx, a, o)
	case admission.Update:
		return b.validateUpdate(ctx, a, o)
	case admission.Connect:
		return nil
	}

	return nil
}

// validateDelete checks if a dashboard can be deleted
func (b *DashboardsAPIBuilder) validateDelete(ctx context.Context, a admission.Attributes) error {
	obj := a.GetOperationOptions()
	deleteOptions, ok := obj.(*metav1.DeleteOptions)
	if !ok {
		return fmt.Errorf("expected v1.DeleteOptions")
	}

	// Skip validation for forced deletions (grace period = 0)
	if deleteOptions.GracePeriodSeconds != nil && *deleteOptions.GracePeriodSeconds == 0 {
		return nil
	}

	nsInfo, err := claims.ParseNamespace(a.GetNamespace())
	if err != nil {
		return fmt.Errorf("%v: %w", "failed to parse namespace", err)
	}

	// The name of the resource is the dashboard UID
	dashboardUID := a.GetName()

	provisioningData, err := b.dashboardProvisioningService.GetProvisionedDashboardDataByDashboardUID(ctx, nsInfo.OrgID, dashboardUID)
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

	return nil
}

// validateCreate validates dashboard creation
func (b *DashboardsAPIBuilder) validateCreate(
	ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces,
) error {
	dashObj := a.GetObject()

	title, refresh, err := getDashboardProperties(dashObj)
	if err != nil {
		return fmt.Errorf("error extracting dashboard properties: %w", err)
	}

	accessor, err := utils.MetaAccessor(dashObj)
	if err != nil {
		return fmt.Errorf("error getting meta accessor: %w", err)
	}

	dashName := accessor.GetName()

	// Schema validations
	if errs := ValidateDashboardSpec(ctx, getFieldValidationMode(a), dashObj); errs != nil {
		return apierrors.NewInvalid(a.GetKind().GroupKind(), dashName, errs)
	}

	// Basic validations
	if err := b.dashboardService.ValidateBasicDashboardProperties(
		title, dashName, accessor.GetMessage(),
	); err != nil {
		return err
	}

	// Validate refresh interval
	if err := b.dashboardService.ValidateDashboardRefreshInterval(b.cfg.MinRefreshInterval, refresh); err != nil {
		return err
	}

	id, err := identity.GetRequester(ctx)
	if err != nil {
		return fmt.Errorf("error getting requester: %w", err)
	}

	internalId, err := id.GetInternalID()
	if err != nil {
		return fmt.Errorf("error getting internal ID: %w", err)
	}

	// Validate quota
	if !a.IsDryRun() {
		params := &quota.ScopeParameters{}
		params.OrgID = id.GetOrgID()
		params.UserID = internalId

		quotaReached, err := b.QuotaService.CheckQuotaReached(ctx, dashboards.QuotaTargetSrv, params)
		if err != nil && !errors.Is(err, quota.ErrDisabled) {
			return err
		}
		if quotaReached {
			return dashboards.ErrQuotaReached
		}
	}

	return nil
}

// validateUpdate validates dashboard updates
func (b *DashboardsAPIBuilder) validateUpdate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	// Get the new and old dashboards
	newDashObj := a.GetObject()
	oldDashObj := a.GetOldObject()

	title, refresh, err := getDashboardProperties(newDashObj)
	if err != nil {
		return fmt.Errorf("error extracting dashboard properties: %w", err)
	}

	oldAccessor, err := utils.MetaAccessor(oldDashObj)
	if err != nil {
		return fmt.Errorf("error getting old dash meta accessor: %w", err)
	}

	newAccessor, err := utils.MetaAccessor(newDashObj)
	if err != nil {
		return fmt.Errorf("error getting new dash meta accessor: %w", err)
	}

	// Parse namespace for old dashboard
	nsInfo, err := claims.ParseNamespace(oldAccessor.GetNamespace())
	if err != nil {
		return fmt.Errorf("failed to parse namespace: %w", err)
	}

	dashName := newAccessor.GetName()

	// Schema validations
	if errs := ValidateDashboardSpec(ctx, getFieldValidationMode(a), newDashObj); errs != nil {
		return apierrors.NewInvalid(a.GetKind().GroupKind(), dashName, errs)
	}

	// Basic validations
	if err := b.dashboardService.ValidateBasicDashboardProperties(
		title, dashName, newAccessor.GetMessage(),
	); err != nil {
		return err
	}

	// Validate folder existence if specified and changed
	if !a.IsDryRun() && newAccessor.GetFolder() != "" && newAccessor.GetFolder() != oldAccessor.GetFolder() {
		if err := b.validateFolderExists(ctx, newAccessor.GetFolder(), nsInfo.OrgID); err != nil {
			return err
		}
	}

	// Validate refresh interval
	if err := b.dashboardService.ValidateDashboardRefreshInterval(b.cfg.MinRefreshInterval, refresh); err != nil {
		return err
	}

	allowOverwrite := false // TODO: Add support for overwrite flag
	// check for is someone else has written in between
	if newAccessor.GetGeneration() != oldAccessor.GetGeneration() {
		if allowOverwrite {
			newAccessor.SetGeneration(oldAccessor.GetGeneration())
		} else {
			return dashboards.ErrDashboardVersionMismatch
		}
	}

	return nil
}

// validateFolderExists checks if a folder exists
func (b *DashboardsAPIBuilder) validateFolderExists(ctx context.Context, folderUID string, orgID int64) error {
	// Check if folder exists using the folder store
	_, err := b.folderClient.Get(ctx, folderUID, orgID, metav1.GetOptions{})

	if err != nil {
		if errors.Is(err, dashboards.ErrFolderNotFound) {
			return err
		}
		return fmt.Errorf("error checking folder existence: %w", err)
	}

	return nil
}

// getDashboardProperties extracts title and refresh interval from any dashboard version
func getDashboardProperties(obj runtime.Object) (string, string, error) {
	var title, refresh string

	// Extract properties based on the object's type
	switch d := obj.(type) {
	case *v0alpha1.Dashboard:
		title = d.Spec.GetNestedString(dashboardSpecTitle)
		refresh = d.Spec.GetNestedString(dashboardSpecRefreshInterval)
	case *v1alpha1.Dashboard:
		title = d.Spec.GetNestedString(dashboardSpecTitle)
		refresh = d.Spec.GetNestedString(dashboardSpecRefreshInterval)
	case *v2alpha1.Dashboard:
		title = d.Spec.Title
		refresh = d.Spec.TimeSettings.AutoRefresh
	default:
		return "", "", fmt.Errorf("unsupported dashboard version: %T", obj)
	}

	return title, refresh, nil
}

// ValidateDashboardSpec validates the dashboard spec.
func ValidateDashboardSpec(ctx context.Context, mode string, obj runtime.Object) field.ErrorList {
	if mode == metav1.FieldValidationIgnore {
		// We don't want to validate the dashboard spec if the validation is set to ignore.
		return nil
	}

	if mode == metav1.FieldValidationWarn {
		// TODO: not sure how to return warnings
		return nil
	}

	switch v := obj.(type) {
	case *v0alpha1.Dashboard:
		// No-ip for v0, we don't care about validating this API.
	case *v1alpha1.Dashboard:
		return dashboardkind.ValidateDashboardSpec(ctx, v.Spec)
	case *v2alpha1.Dashboard:
		// TODO: do we want to run CUE-based validation here?
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
