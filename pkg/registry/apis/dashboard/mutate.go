package dashboard

import (
	"context"
	"fmt"
	"reflect"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1"
	dashboardV2 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2"
	dashboardV2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashboardV2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/folder"
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
	// Reachability invariant: variable storage is always registered, but
	// FlagGrafanaDashboardGlobalVariables is gated per request in GetAuthorizer.
	// When the feature is disabled the authorizer denies the request (403)
	// before admission runs, so this case only fires when global variables
	// are enabled.
	case dashboardV2beta1.VariableResourceInfo.GroupVersionResource().Resource:
		return mutateVariable(a)

	// Reachability invariant: this case only fires when the apiserver routes a
	// request to the v2beta1 Notebook storage, which is registered in
	// UpdateAPIGroupInfo behind FlagDashboardNotebooks (see register.go).
	// Layout validation happens in Validate.
	case dashboardV2beta1.NotebookResourceInfo.GroupVersionResource().Resource:
		return mutateNotebook(a)

	// Reachability invariant: dashboard preferences storage is always registered, but
	// FlagGrafanaDashboardPreferences is enforced per request in GetAuthorizer. With
	// the flag off no identity may create or update, so this case only fires when
	// the feature is enabled.
	case dashboardV2beta1.DashboardPreferencesResourceInfo.GroupVersionResource().Resource:
		return mutateDashboardPreferences(a)

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
				Error:  new(migrationErr.Error()),
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
		// Strip BOMs from all string fields recursively
		util.StripBOMFromStruct(&v.Spec)
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
		// Strip BOMs from all string fields recursively
		util.StripBOMFromStruct(&v.Spec)
		resourceInfo = dashboardV2beta1.DashboardResourceInfo

	case *dashboardV2.Dashboard:
		if v.Spec.Layout.GridLayoutKind == nil && v.Spec.Layout.RowsLayoutKind == nil && v.Spec.Layout.AutoGridLayoutKind == nil && v.Spec.Layout.TabsLayoutKind == nil {
			v.Spec.Layout.GridLayoutKind = &dashboardV2.DashboardGridLayoutKind{
				Kind: "GridLayout",
				Spec: dashboardV2.DashboardGridLayoutSpec{},
			}
		}
		// Strip BOMs from all string fields recursively
		util.StripBOMFromStruct(&v.Spec)
		resourceInfo = dashboardV2.DashboardResourceInfo

	default:
		return fmt.Errorf("mutation error: expected to dashboard, got %T", obj)
	}

	if internalID != 0 {
		meta.SetDeprecatedInternalID(internalID) // nolint:staticcheck
	}

	return b.validateDashboardIfStrict(ctx, a, migrationErr, resourceInfo)
}

// validateDashboardIfStrict validates the dashboard spec if field validation mode is strict.
func (b *DashboardsAPIBuilder) validateDashboardIfStrict(ctx context.Context, a admission.Attributes, migrationErr error, resourceInfo utils.ResourceInfo) error {
	obj := a.GetObject()
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
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

func mutateVariable(a admission.Attributes) error {
	variable, ok := a.GetObject().(*dashboardV2beta1.Variable)
	if !ok {
		return fmt.Errorf("mutation error: expected variable, got %T", a.GetObject())
	}

	meta, err := utils.MetaAccessor(variable)
	if err != nil {
		return err
	}

	labels := variable.GetLabels()
	if labels == nil {
		labels = make(map[string]string)
	}

	// Apistore stamps the canonical "general" sentinel on root-parented
	// resources, so both "" and "general" mean "global scope" for the
	// uniqueness label — set no folder label in that case. Without this,
	// re-reading a stamped object on update would mirror "general" into the
	// label and incorrectly flip a global variable into folder scope.
	if folderUID := meta.GetFolder(); !folder.IsRootFolderUID(folderUID) {
		labels[variableFolderLabelKey] = folderUID
	} else {
		delete(labels, variableFolderLabelKey)
	}
	variable.SetLabels(labels)

	if a.GetOperation() == admission.Create && variable.GetName() == "" {
		variable.SetName(deriveVariableMetadataName(getVariableName(variable.Spec), meta.GetFolder()))
	}

	return nil
}

// Create and update differ only in the name: a PATCH that creates a missing object runs against a
// placeholder with a UID, so it is admitted as an update, and everything else has to hold on both.
func mutateDashboardPreferences(a admission.Attributes) error {
	obj, ok := a.GetObject().(*dashboardV2beta1.DashboardPreferences)
	if !ok {
		return fmt.Errorf("mutation error: expected dashboard preferences, got %T", a.GetObject())
	}

	// Without a scope there is no tier label to set, and a nameless object that got past here would be
	// rejected with a generic 422 before Validate could say why.
	scope, err := dashboardPreferencesScopeOf(obj)
	if err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	// Rebuilt from the scope on every write, never taken from the client: List finds folder-tier objects
	// by the tier label, so a client-chosen value could hide a folder's preferences from its readers.
	labels := obj.GetLabels()
	if labels == nil {
		labels = make(map[string]string)
	}
	// No folder label: a label value must start and end with an alphanumeric character, and a folder UID
	// need not. Lookups go by name, and List needs only the tier label.
	delete(labels, dashboardPreferencesFolderLabelKey)
	labels[dashboardPreferencesTierLabelKey] = string(scope.Tier)
	obj.SetLabels(labels)

	// A merge-patch that sets the last member of an object to null leaves the object behind empty, and
	// absent is the one spelling of "inherit". Children go first, so a parent left with only empty
	// children goes too. timeRange stays: its members are required, so an empty one has to fail Validate.
	if p := obj.Spec.Panels; p != nil {
		p.Legend = nilIfUnset(p.Legend)
		p.Tooltip = nilIfUnset(p.Tooltip)
		p.Axis = nilIfUnset(p.Axis)
		p.Graph = nilIfUnset(p.Graph)
		p.Field = nilIfUnset(p.Field)
		p.Frame = nilIfUnset(p.Frame)
		obj.Spec.Panels = nilIfUnset(p)
	}
	if d := obj.Spec.Dashboard; d != nil {
		d.AutoGrid = nilIfUnset(d.AutoGrid)
		obj.Spec.Dashboard = nilIfUnset(d)
	}

	// No controller owns these objects, so a finalizer would keep a deleted tier, which is personal data
	// for the user tier, in storage forever.
	obj.SetFinalizers(nil)
	obj.SetOwnerReferences(nil)

	if a.GetOperation() == admission.Create && obj.GetName() == "" {
		obj.SetName(deriveDashboardPreferencesMetadataName(scope))
	}

	return nil
}

// nilIfUnset returns nil for an object with no member set. Every member of the objects it is used on
// is optional, so each is a pointer or a list and is unset only when nil: false, 0, "" and [] are set.
func nilIfUnset[T any](obj *T) *T {
	if obj == nil || reflect.ValueOf(*obj).IsZero() {
		return nil
	}
	return obj
}

// Matches the title the UI gives a new notebook, so a notebook created through the API is not named
// differently from one created by clicking New. Sortable rather than localized, for the same reason
// it is in the UI: these titles are read as a list.
const notebookDefaultTitleFormat = "Notebook 2006-01-02 15:04"

// mutateNotebook normalizes a notebook on its way in.
//
// It names a notebook that was created without a title. Nothing requires one — `title` is a plain
// string in the spec, so an omitted title arrives as "" and becomes a blank row in the notebooks list
// with nothing to click. Create only: re-titling on update would stamp a notebook someone deliberately
// cleared with the time it was edited rather than created, which is worse than the blank it replaces.
//
// It also forces `hideTimepicker` off, on create and update. A notebook has no settings UI to show the
// picker again, so a hidden one could never be recovered by the person looking at it.
func mutateNotebook(a admission.Attributes) error {
	notebook, ok := a.GetObject().(*dashboardV2beta1.Notebook)
	if !ok {
		return fmt.Errorf("mutation error: expected notebook, got %T", a.GetObject())
	}

	// UTC, where the UI uses the signed-in user's timezone: admission has no user timezone to format
	// in — the preference can be "browser", which means nothing without a browser to ask.
	if a.GetOperation() == admission.Create && strings.TrimSpace(notebook.Spec.Title) == "" {
		notebook.Spec.Title = time.Now().UTC().Format(notebookDefaultTitleFormat)
	}

	notebook.Spec.TimeSettings.HideTimepicker = false

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
