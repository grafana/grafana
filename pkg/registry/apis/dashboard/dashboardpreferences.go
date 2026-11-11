package dashboard

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"
	"k8s.io/utils/ptr"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-plugin-sdk-go/backend/gtime"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apimachinery/validation"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
)

type dashboardPreferencesTier string

const (
	dashboardPreferencesTierOrg    dashboardPreferencesTier = "org"
	dashboardPreferencesTierFolder dashboardPreferencesTier = "folder"
	dashboardPreferencesTierUser   dashboardPreferencesTier = "user"
)

const (
	dashboardPreferencesFolderNamePrefix = "folder-"
	dashboardPreferencesUserNamePrefix   = "user-"
	dashboardPreferencesMergedName       = "merged"
	dashboardPreferencesFolderLabelKey   = utils.AnnoKeyFolder
	// Lets List read folder-tier objects with an indexable label selector instead of scanning user objects.
	dashboardPreferencesTierLabelKey = "dashboard.grafana.app/preferences-tier"
)

// Comparable with ==; FolderUID is set only for the folder tier, UserUID only for the user tier.
type dashboardPreferencesScope struct {
	Tier      dashboardPreferencesTier
	FolderUID string
	UserUID   string
}

// The name is the only source of the scope, as in preferences.grafana.app, so an object without a name,
// such as a POST before Mutate names it, is in the org tier.
func dashboardPreferencesScopeOf(obj *dashv2beta1.DashboardPreferences) (dashboardPreferencesScope, error) {
	if obj == nil {
		return dashboardPreferencesScope{}, fmt.Errorf("dashboard preferences payload is required")
	}

	accessor, err := utils.MetaAccessor(obj)
	if err != nil {
		return dashboardPreferencesScope{}, fmt.Errorf("error getting dashboard preferences meta accessor: %w", err)
	}
	// The folder tier names its folder instead of carrying the annotation: storage would hold an
	// annotated object to its folder's rules for content, such as a synced folder taking only its
	// repository's objects.
	if accessor.GetFolder() != "" {
		return dashboardPreferencesScope{}, fmt.Errorf("dashboard preferences can't have the grafana.app/folder annotation; the folder tier is named %s<folderUID>", dashboardPreferencesFolderNamePrefix)
	}

	name := obj.GetName()
	if name == "" {
		return dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}, nil
	}
	scope, ok := dashboardPreferencesScopeFromName(name)
	if !ok {
		return dashboardPreferencesScope{}, fmt.Errorf("metadata.name %q is not a dashboard preferences name; use %s, %s<folderUID> or %s<userUID>",
			name, dashv2beta1.DashboardPreferencesOrgName, dashboardPreferencesFolderNamePrefix, dashboardPreferencesUserNamePrefix)
	}
	return scope, nil
}

func dashboardPreferencesScopeFromName(name string) (dashboardPreferencesScope, bool) {
	// A name that storage would refuse can't belong to a stored object, so it is not a scope.
	if len(validation.IsValidGrafanaName(name)) > 0 {
		return dashboardPreferencesScope{}, false
	}

	if name == dashv2beta1.DashboardPreferencesOrgName {
		return dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}, true
	}

	if folderUID, ok := strings.CutPrefix(name, dashboardPreferencesFolderNamePrefix); ok {
		// Root-level preferences live in the org tier object, so "folder-general" is not a name, and
		// shared-with-me is not a real folder.
		if folder.IsRootFolderUID(folderUID) || folderUID == folder.SharedWithMeFolderUID {
			return dashboardPreferencesScope{}, false
		}
		return dashboardPreferencesScope{Tier: dashboardPreferencesTierFolder, FolderUID: folderUID}, true
	}

	if userUID, ok := strings.CutPrefix(name, dashboardPreferencesUserNamePrefix); ok && userUID != "" {
		return dashboardPreferencesScope{Tier: dashboardPreferencesTierUser, UserUID: userUID}, true
	}

	return dashboardPreferencesScope{}, false
}

func deriveDashboardPreferencesMetadataName(scope dashboardPreferencesScope) string {
	switch scope.Tier {
	case dashboardPreferencesTierOrg:
		return dashv2beta1.DashboardPreferencesOrgName
	case dashboardPreferencesTierFolder:
		return dashv2beta1.DashboardPreferencesFolderName(scope.FolderUID)
	case dashboardPreferencesTierUser:
		return dashv2beta1.DashboardPreferencesUserName(scope.UserUID)
	default:
		// An unset tier must fail name validation instead of resolving to another tier's object.
		return ""
	}
}

func (b *DashboardsAPIBuilder) validateDashboardPreferencesCreate(ctx context.Context, a admission.Attributes) error {
	obj, ok := a.GetObject().(*dashv2beta1.DashboardPreferences)
	if !ok {
		return fmt.Errorf("unsupported dashboard preferences version: %T", a.GetObject())
	}

	if err := validateDashboardPreferencesNotManaged(obj); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	scope, err := dashboardPreferencesScopeOf(obj)
	if err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	name := obj.GetName()
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return fmt.Errorf("error getting requester: %w", err)
	}

	// The authorizer can't see the name of a POST, so the tier rules for that name run here, before the
	// payload checks, as they would for a PUT. Access-policy tokens are left out: the authorizer already
	// restricted them, and a token has no user for the tier rules to judge.
	if !requester.IsIdentityType(authlib.TypeAccessPolicy) {
		decision, reason, err := authorizeDashboardPreferencesName(ctx, b.accessClient, b.accessControl, requester, a.GetNamespace(), name, utils.VerbCreate)
		if err != nil {
			return err
		}
		if decision != authorizer.DecisionAllow {
			return apierrors.NewForbidden(dashv2beta1.DashboardPreferencesResourceInfo.GroupResource(), name, errors.New(reason))
		}
	}

	valueErrs := b.validateDashboardPreferencesValues(ctx, a.GetNamespace(), obj.Spec, nil)
	if err := validateDashboardPreferencesSpec(name, obj.Spec, valueErrs...); err != nil {
		return err
	}

	if scope.Tier == dashboardPreferencesTierFolder && !a.IsDryRun() {
		nsInfo, err := request.NamespaceInfoFrom(ctx, true)
		if err != nil {
			return err
		}
		if _, err := b.validateFolderExists(ctx, scope.FolderUID, nsInfo.OrgID); err != nil {
			return err
		}
	}

	return nil
}

// Unlike a create, an update is not authorized here: PUT and PATCH reach the authorizer with the name,
// which gives the scope and can't change.
func (b *DashboardsAPIBuilder) validateDashboardPreferencesUpdate(ctx context.Context, a admission.Attributes) error {
	obj, ok := a.GetObject().(*dashv2beta1.DashboardPreferences)
	if !ok {
		return fmt.Errorf("unsupported dashboard preferences version: %T", a.GetObject())
	}

	oldObj, ok := a.GetOldObject().(*dashv2beta1.DashboardPreferences)
	if !ok || oldObj == nil {
		return fmt.Errorf("unsupported old dashboard preferences version: %T", a.GetOldObject())
	}

	if err := validateDashboardPreferencesNotManaged(obj); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	if _, err := dashboardPreferencesScopeOf(obj); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	name := obj.GetName()
	valueErrs := b.validateDashboardPreferencesValues(ctx, a.GetNamespace(), obj.Spec, &oldObj.Spec)
	return validateDashboardPreferencesSpec(name, obj.Spec, valueErrs...)
}

// validateDashboardPreferencesValues checks what the schema can't express. old is the stored spec on an
// update and nil on a create.
func (b *DashboardsAPIBuilder) validateDashboardPreferencesValues(ctx context.Context, namespace string, spec dashv2beta1.DashboardPreferencesSpec, old *dashv2beta1.DashboardPreferencesSpec) field.ErrorList {
	var errs field.ErrorList
	if spec.Dashboard != nil {
		var oldDashboard dashv2beta1.DashboardPreferencesDashboardDefaults
		if old != nil && old.Dashboard != nil {
			oldDashboard = *old.Dashboard
		}
		errs = b.validateDashboardPreferencesDashboard(ctx, namespace, *spec.Dashboard, oldDashboard)
	}

	// Nothing applies panel preferences to new panels yet, so they would be stored and silently ignored.
	if spec.Panels != nil {
		errs = append(errs, field.Forbidden(field.NewPath("spec", "panels"), "panel preferences are not supported yet"))
	}
	for i, path := range spec.Reset {
		if strings.HasPrefix(string(path), "panels.") {
			errs = append(errs, field.Forbidden(field.NewPath("spec", "reset", strconv.Itoa(i)), "panel preferences are not supported yet"))
		}
	}

	return errs
}

// The refresh checks judge only a value that changed, so raising min_refresh_interval doesn't stop edits
// to the other fields of a tier saved under the old minimum. On a create, old is empty and every value
// set is a change.
func (b *DashboardsAPIBuilder) validateDashboardPreferencesDashboard(ctx context.Context, namespace string, d, old dashv2beta1.DashboardPreferencesDashboardDefaults) field.ErrorList {
	var errs field.ErrorList
	path := field.NewPath("spec", "dashboard")

	// Each stack can set its own minimum in the settings service, so it is read at most once per write, and
	// only for a value that it applies to.
	minRefreshInterval := sync.OnceValue(func() string { return b.minRefreshIntervalFor(ctx, namespace) })
	checkRefresh := func(value string) error {
		if value == "" || value == "auto" {
			return nil
		}
		// The minimum check parses the value only when a minimum is set.
		if _, err := gtime.ParseDuration(value); err != nil {
			return fmt.Errorf("parsing refresh duration %q failed: %w", value, err)
		}
		return b.dashboardService.ValidateDashboardRefreshInterval(minRefreshInterval(), value)
	}

	if d.AutoRefresh != nil && !ptr.Equal(d.AutoRefresh, old.AutoRefresh) {
		if err := checkRefresh(*d.AutoRefresh); err != nil {
			errs = append(errs, field.Invalid(path.Child("autoRefresh"), *d.AutoRefresh, err.Error()))
		}
	}

	// JSON [] decodes to an empty list, which encodes as no list, so it would be stored as "inherit".
	if d.AutoRefreshIntervals != nil && len(d.AutoRefreshIntervals) == 0 {
		errs = append(errs, field.Invalid(path.Child("autoRefreshIntervals"), d.AutoRefreshIntervals, "must not be empty; send null to clear it"))
	}
	if !slices.Equal(d.AutoRefreshIntervals, old.AutoRefreshIntervals) {
		for i, interval := range d.AutoRefreshIntervals {
			// Named like the schema's causes, which give a list entry's index as a path element.
			entry := path.Child("autoRefreshIntervals", strconv.Itoa(i))
			// The refresh check passes "auto" as a dashboard's refresh value, but the time picker adds its own
			// Auto option, so it is not an interval to list. The schema already rejects "".
			if interval == "auto" {
				errs = append(errs, field.Invalid(entry, interval, "must be a duration such as 30s or 1m"))
				continue
			}
			if err := checkRefresh(interval); err != nil {
				errs = append(errs, field.Invalid(entry, interval, err.Error()))
			}
		}
	}

	if d.NowDelay != nil && !isValidDashboardPreferencesNowDelay(*d.NowDelay) {
		errs = append(errs, field.Invalid(path.Child("nowDelay"), *d.NowDelay, "must be one amount and unit such as 30s or 1m"))
	}

	// The layout editor's minimums; the schema only bounds these at 0.
	if grid := d.AutoGrid; grid != nil {
		gridPath := path.Child("autoGrid")
		if grid.MaxColumnCount != nil && *grid.MaxColumnCount < 1 {
			errs = append(errs, field.Invalid(gridPath.Child("maxColumnCount"), *grid.MaxColumnCount, "must be at least 1"))
		}
		if grid.ColumnWidth != nil && *grid.ColumnWidth < 50 {
			errs = append(errs, field.Invalid(gridPath.Child("columnWidth"), *grid.ColumnWidth, "must be at least 50"))
		}
		if grid.RowHeight != nil && *grid.RowHeight < 50 {
			errs = append(errs, field.Invalid(gridPath.Child("rowHeight"), *grid.RowHeight, "must be at least 50"))
		}
	}

	return errs
}

// Dashboards apply nowDelay as the date math "now-" + nowDelay, so a value must be one amount and one unit
// that the frontend's date math knows. Compounds such as 1m+1h could end the range after now.
var dashboardPreferencesNowDelayFormat = regexp.MustCompile(`^[0-9]{1,5}[smhdwMQy]$`)

func isValidDashboardPreferencesNowDelay(value string) bool {
	if !dashboardPreferencesNowDelayFormat.MatchString(value) {
		return false
	}

	now := time.Now()
	end, err := gtime.TimeRange{From: "now", To: "now-" + value, Now: now}.ParseTo()
	// 0m is valid date math, but it ends the range at now, so it delays nothing.
	return err == nil && end.Before(now)
}

// Nothing manages dashboard preferences: the authorizer denies Git Sync writes, and the storage layer
// would hand writes of a repository-managed object to the repository, out of the owner's reach.
func validateDashboardPreferencesNotManaged(obj *dashv2beta1.DashboardPreferences) error {
	annotations := obj.GetAnnotations()
	_, hasKind := annotations[utils.AnnoKeyManagerKind]
	_, hasIdentity := annotations[utils.AnnoKeyManagerIdentity]
	if hasKind || hasIdentity {
		return errors.New("dashboard preferences can't be managed by a repository")
	}

	// Also reject anything the platform's manager accessor reports as managed.
	accessor, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}
	if _, managed := accessor.GetManagerProperties(); managed {
		return errors.New("dashboard preferences can't be managed by a repository")
	}
	return nil
}
