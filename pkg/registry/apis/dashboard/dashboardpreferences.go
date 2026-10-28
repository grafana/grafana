package dashboard

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
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
	dashboardPreferencesFolderNamePrefix      = "folder-"
	dashboardPreferencesUserNamePrefix        = "user-"
	dashboardPreferencesMergedName            = "merged"
	dashboardPreferencesMetadataNameMaxLength = 253
	dashboardPreferencesFolderLabelKey        = utils.AnnoKeyFolder
	// Lets List read folder-tier objects with an indexable label selector instead of scanning user objects.
	dashboardPreferencesTierLabelKey = "dashboard.grafana.app/preferences-tier"
)

// Comparable with ==; FolderUID is set only for the folder tier, UserUID only for the user tier.
type dashboardPreferencesScope struct {
	Tier      dashboardPreferencesTier
	FolderUID string
	UserUID   string
}

// A root folder annotation ("" or "general") is not a folder scope, so a root-level object that carries
// "general" stays in the org or user tier instead of becoming "folder-general".
func getDashboardPreferencesScope(folderUID string, userUID *string) (dashboardPreferencesScope, error) {
	if userUID != nil && *userUID == "" {
		return dashboardPreferencesScope{}, fmt.Errorf("spec.userUID must not be empty")
	}

	hasFolder := !folder.IsRootFolderUID(folderUID)
	if hasFolder && userUID != nil {
		return dashboardPreferencesScope{}, fmt.Errorf("set either the grafana.app/folder annotation or spec.userUID, not both")
	}
	if folderUID == folder.SharedWithMeFolderUID {
		return dashboardPreferencesScope{}, fmt.Errorf("the grafana.app/folder annotation must not be %q: it is not a real folder", folderUID)
	}

	switch {
	case userUID != nil:
		return dashboardPreferencesScope{Tier: dashboardPreferencesTierUser, UserUID: *userUID}, nil
	case hasFolder:
		return dashboardPreferencesScope{Tier: dashboardPreferencesTierFolder, FolderUID: folderUID}, nil
	default:
		return dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}, nil
	}
}

func dashboardPreferencesScopeOf(obj *dashv2beta1.DashboardPreferences) (dashboardPreferencesScope, error) {
	if obj == nil {
		return dashboardPreferencesScope{}, fmt.Errorf("dashboard preferences payload is required")
	}

	accessor, err := utils.MetaAccessor(obj)
	if err != nil {
		return dashboardPreferencesScope{}, fmt.Errorf("error getting dashboard preferences meta accessor: %w", err)
	}

	return getDashboardPreferencesScope(accessor.GetFolder(), obj.Spec.UserUID)
}

func dashboardPreferencesScopeFromName(name string) (dashboardPreferencesScope, bool) {
	// A name that validateDashboardPreferencesMetadataName would reject can't belong to a stored object,
	// so it is not a scope.
	if len(validation.IsValidGrafanaName(name)) > 0 {
		return dashboardPreferencesScope{}, false
	}

	if name == dashv2beta1.DashboardPreferencesOrgName {
		return dashboardPreferencesScope{Tier: dashboardPreferencesTierOrg}, true
	}

	if folderUID, ok := strings.CutPrefix(name, dashboardPreferencesFolderNamePrefix); ok {
		// Root-level preferences live in the org tier object, so "folder-general" is not a name.
		scope, err := getDashboardPreferencesScope(folderUID, nil)
		if err != nil || scope.Tier != dashboardPreferencesTierFolder {
			return dashboardPreferencesScope{}, false
		}
		return scope, true
	}

	if userUID, ok := strings.CutPrefix(name, dashboardPreferencesUserNamePrefix); ok {
		scope, err := getDashboardPreferencesScope("", &userUID)
		if err != nil {
			return dashboardPreferencesScope{}, false
		}
		return scope, true
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

func validateDashboardPreferencesMetadataName(gotName string, scope dashboardPreferencesScope) error {
	expectedName := deriveDashboardPreferencesMetadataName(scope)
	if len(expectedName) > dashboardPreferencesMetadataNameMaxLength {
		return fmt.Errorf("derived metadata.name exceeds maximum length (%d)", dashboardPreferencesMetadataNameMaxLength)
	}
	if errs := validation.IsValidGrafanaName(expectedName); len(errs) > 0 {
		return fmt.Errorf("derived metadata.name %q is invalid: %s", expectedName, strings.Join(errs, "; "))
	}
	if gotName == "" || gotName == expectedName {
		return nil
	}

	return fmt.Errorf(
		"metadata.name %q does not match the name required for this %s tier: expected %q (omit metadata.name to let the server set it)",
		gotName,
		scope.Tier,
		expectedName,
	)
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
	if err := validateDashboardPreferencesMetadataName(name, scope); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	if err := validateDashboardPreferencesSpec(name, obj.Spec); err != nil {
		return err
	}

	if err := b.validateDashboardPreferencesValues(obj.Spec, nil); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return fmt.Errorf("error getting requester: %w", err)
	}

	// The authorizer can't see the name of a POST, so the tier rules for that name run here.
	// Access-policy tokens are left out: the authorizer already restricted them, and a token has no
	// user for the tier rules to judge.
	if !requester.IsIdentityType(authlib.TypeAccessPolicy) {
		decision, reason, err := authorizeDashboardPreferencesName(ctx, b.accessClient, requester, a.GetNamespace(), name, utils.VerbCreate)
		if err != nil {
			return err
		}
		if decision != authorizer.DecisionAllow {
			return apierrors.NewForbidden(dashv2beta1.DashboardPreferencesResourceInfo.GroupResource(), name, errors.New(reason))
		}
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
// and the name has to match a scope that can't change.
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

	scope, err := dashboardPreferencesScopeOf(obj)
	if err != nil {
		return apierrors.NewBadRequest(err.Error())
	}
	oldScope, err := dashboardPreferencesScopeOf(oldObj)
	if err != nil {
		return fmt.Errorf("error getting the scope of the stored dashboard preferences: %w", err)
	}
	if scope != oldScope {
		return apierrors.NewBadRequest("dashboard preferences scope (grafana.app/folder annotation and spec.userUID) cannot be changed; delete it and create a new one")
	}

	name := obj.GetName()
	if err := validateDashboardPreferencesMetadataName(name, scope); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	if err := validateDashboardPreferencesSpec(name, obj.Spec); err != nil {
		return err
	}

	if err := b.validateDashboardPreferencesValues(obj.Spec, &oldObj.Spec); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	return nil
}

// validateDashboardPreferencesValues checks what the schema can't express. old is the stored spec on an
// update and nil on a create.
func (b *DashboardsAPIBuilder) validateDashboardPreferencesValues(spec dashv2beta1.DashboardPreferencesSpec, old *dashv2beta1.DashboardPreferencesSpec) error {
	if spec.Dashboard != nil {
		var oldDashboard dashv2beta1.DashboardPreferencesDashboardDefaults
		if old != nil && old.Dashboard != nil {
			oldDashboard = *old.Dashboard
		}
		if err := b.validateDashboardPreferencesDashboard(*spec.Dashboard, oldDashboard); err != nil {
			return err
		}
	}

	if spec.Panels != nil && spec.Panels.Graph != nil {
		if size := spec.Panels.Graph.PointSize; size != nil && *size < 1 {
			return errors.New("spec.panels.graph.pointSize must be at least 1")
		}
	}

	// Nothing applies panel preferences to new panels yet, so they would be stored and silently ignored.
	if spec.Panels != nil {
		return errors.New("panel preferences are not supported yet")
	}

	return nil
}

// The refresh checks judge only a value that changed, so raising min_refresh_interval doesn't stop edits
// to the other fields of a tier saved under the old minimum. On a create, old is empty and every value
// set is a change.
func (b *DashboardsAPIBuilder) validateDashboardPreferencesDashboard(d, old dashv2beta1.DashboardPreferencesDashboardDefaults) error {
	if d.AutoRefresh != nil && !ptr.Equal(d.AutoRefresh, old.AutoRefresh) {
		if err := b.dashboardService.ValidateDashboardRefreshInterval(b.minRefreshInterval, *d.AutoRefresh); err != nil {
			return fmt.Errorf("spec.dashboard.autoRefresh: %w", err)
		}
	}

	// JSON [] decodes to an empty list, which encodes as no list, so it would be stored as "inherit".
	if d.AutoRefreshIntervals != nil && len(d.AutoRefreshIntervals) == 0 {
		return errors.New("spec.dashboard.autoRefreshIntervals must not be empty; send null to clear it")
	}
	if !slices.Equal(d.AutoRefreshIntervals, old.AutoRefreshIntervals) {
		for i, interval := range d.AutoRefreshIntervals {
			// The refresh check passes "auto" as a dashboard's refresh value, but the time picker adds its own
			// Auto option, so it is not an interval to list. The schema already rejects "".
			if interval == "auto" {
				return fmt.Errorf("spec.dashboard.autoRefreshIntervals[%d] must be a duration such as 30s or 1m, not %q", i, interval)
			}
			if err := b.dashboardService.ValidateDashboardRefreshInterval(b.minRefreshInterval, interval); err != nil {
				return fmt.Errorf("spec.dashboard.autoRefreshIntervals[%d]: %w", i, err)
			}
		}
	}

	if d.NowDelay != nil && !isValidDashboardPreferencesNowDelay(*d.NowDelay) {
		return fmt.Errorf("spec.dashboard.nowDelay must be one amount and unit such as 30s or 1m, not %q", *d.NowDelay)
	}

	// The layout editor's minimums; the schema only bounds these at 0.
	if grid := d.AutoGrid; grid != nil {
		switch {
		case grid.MaxColumnCount != nil && *grid.MaxColumnCount < 1:
			return errors.New("spec.dashboard.autoGrid.maxColumnCount must be at least 1")
		case grid.ColumnWidth != nil && *grid.ColumnWidth < 50:
			return errors.New("spec.dashboard.autoGrid.columnWidth must be at least 50")
		case grid.RowHeight != nil && *grid.RowHeight < 50:
			return errors.New("spec.dashboard.autoGrid.rowHeight must be at least 50")
		}
	}

	return nil
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
