package dashboard

import (
	"context"
	"errors"
	"fmt"
	"strings"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/authorization/authorizer"

	authlib "github.com/grafana/authlib/types"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apimachinery/validation"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
)

type dashboardSettingsTier string

const (
	dashboardSettingsTierOrg    dashboardSettingsTier = "org"
	dashboardSettingsTierFolder dashboardSettingsTier = "folder"
	dashboardSettingsTierUser   dashboardSettingsTier = "user"
)

const (
	dashboardSettingsFolderNamePrefix      = "folder-"
	dashboardSettingsUserNamePrefix        = "user-"
	dashboardSettingsMergedName            = "merged"
	dashboardSettingsMetadataNameMaxLength = 253
	dashboardSettingsFolderLabelKey        = utils.AnnoKeyFolder
	// Lets List read folder-tier objects with an indexable label selector instead of scanning user objects.
	dashboardSettingsTierLabelKey = "dashboard.grafana.app/settings-tier"
)

// Comparable with ==; FolderUID is set only for the folder tier, UserUID only for the user tier.
type dashboardSettingsScope struct {
	Tier      dashboardSettingsTier
	FolderUID string
	UserUID   string
}

// A root folder annotation ("" or "general") is not a folder scope, so a root-level object that carries
// "general" stays in the org or user tier instead of becoming "folder-general".
func getDashboardSettingsScope(folderUID string, userUID *string) (dashboardSettingsScope, error) {
	if userUID != nil && *userUID == "" {
		return dashboardSettingsScope{}, fmt.Errorf("spec.userUID must not be empty")
	}

	hasFolder := !folder.IsRootFolderUID(folderUID)
	if hasFolder && userUID != nil {
		return dashboardSettingsScope{}, fmt.Errorf("set either the grafana.app/folder annotation or spec.userUID, not both")
	}
	if folderUID == folder.SharedWithMeFolderUID {
		return dashboardSettingsScope{}, fmt.Errorf("the grafana.app/folder annotation must not be %q: it is not a real folder", folderUID)
	}

	switch {
	case userUID != nil:
		return dashboardSettingsScope{Tier: dashboardSettingsTierUser, UserUID: *userUID}, nil
	case hasFolder:
		return dashboardSettingsScope{Tier: dashboardSettingsTierFolder, FolderUID: folderUID}, nil
	default:
		return dashboardSettingsScope{Tier: dashboardSettingsTierOrg}, nil
	}
}

func dashboardSettingsScopeOf(obj *dashv2beta1.DashboardSettings) (dashboardSettingsScope, error) {
	if obj == nil {
		return dashboardSettingsScope{}, fmt.Errorf("dashboard settings payload is required")
	}

	accessor, err := utils.MetaAccessor(obj)
	if err != nil {
		return dashboardSettingsScope{}, fmt.Errorf("error getting dashboard settings meta accessor: %w", err)
	}

	return getDashboardSettingsScope(accessor.GetFolder(), obj.Spec.UserUID)
}

func dashboardSettingsScopeFromName(name string) (dashboardSettingsScope, bool) {
	// A name that validateDashboardSettingsMetadataName would reject can't belong to a stored object,
	// so it is not a scope.
	if len(validation.IsValidGrafanaName(name)) > 0 {
		return dashboardSettingsScope{}, false
	}

	if name == dashv2beta1.DashboardSettingsOrgName {
		return dashboardSettingsScope{Tier: dashboardSettingsTierOrg}, true
	}

	if folderUID, ok := strings.CutPrefix(name, dashboardSettingsFolderNamePrefix); ok {
		// Root-level settings live in the org tier object, so "folder-general" is not a name.
		scope, err := getDashboardSettingsScope(folderUID, nil)
		if err != nil || scope.Tier != dashboardSettingsTierFolder {
			return dashboardSettingsScope{}, false
		}
		return scope, true
	}

	if userUID, ok := strings.CutPrefix(name, dashboardSettingsUserNamePrefix); ok {
		scope, err := getDashboardSettingsScope("", &userUID)
		if err != nil {
			return dashboardSettingsScope{}, false
		}
		return scope, true
	}

	return dashboardSettingsScope{}, false
}

func deriveDashboardSettingsMetadataName(scope dashboardSettingsScope) string {
	switch scope.Tier {
	case dashboardSettingsTierOrg:
		return dashv2beta1.DashboardSettingsOrgName
	case dashboardSettingsTierFolder:
		return dashv2beta1.DashboardSettingsFolderName(scope.FolderUID)
	case dashboardSettingsTierUser:
		return dashv2beta1.DashboardSettingsUserName(scope.UserUID)
	default:
		// An unset tier must fail name validation instead of resolving to another tier's object.
		return ""
	}
}

func validateDashboardSettingsMetadataName(gotName string, scope dashboardSettingsScope) error {
	expectedName := deriveDashboardSettingsMetadataName(scope)
	if len(expectedName) > dashboardSettingsMetadataNameMaxLength {
		return fmt.Errorf("derived metadata.name exceeds maximum length (%d)", dashboardSettingsMetadataNameMaxLength)
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

func (b *DashboardsAPIBuilder) validateDashboardSettingsCreate(ctx context.Context, a admission.Attributes) error {
	obj, ok := a.GetObject().(*dashv2beta1.DashboardSettings)
	if !ok {
		return fmt.Errorf("unsupported dashboard settings version: %T", a.GetObject())
	}

	if err := validateDashboardSettingsNotManaged(obj); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	scope, err := dashboardSettingsScopeOf(obj)
	if err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	name := obj.GetName()
	if err := validateDashboardSettingsMetadataName(name, scope); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	if err := validateDashboardSettingsSpec(name, obj.Spec); err != nil {
		return err
	}

	if err := b.validateDashboardSettingsAutoRefresh(obj.Spec); err != nil {
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
		decision, reason, err := authorizeDashboardSettingsName(ctx, b.accessClient, requester, a.GetNamespace(), name, utils.VerbCreate)
		if err != nil {
			return err
		}
		if decision != authorizer.DecisionAllow {
			return apierrors.NewForbidden(dashv2beta1.DashboardSettingsResourceInfo.GroupResource(), name, errors.New(reason))
		}
	}

	if scope.Tier == dashboardSettingsTierFolder && !a.IsDryRun() {
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
func (b *DashboardsAPIBuilder) validateDashboardSettingsUpdate(ctx context.Context, a admission.Attributes) error {
	obj, ok := a.GetObject().(*dashv2beta1.DashboardSettings)
	if !ok {
		return fmt.Errorf("unsupported dashboard settings version: %T", a.GetObject())
	}

	oldObj, ok := a.GetOldObject().(*dashv2beta1.DashboardSettings)
	if !ok || oldObj == nil {
		return fmt.Errorf("unsupported old dashboard settings version: %T", a.GetOldObject())
	}

	if err := validateDashboardSettingsNotManaged(obj); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	scope, err := dashboardSettingsScopeOf(obj)
	if err != nil {
		return apierrors.NewBadRequest(err.Error())
	}
	oldScope, err := dashboardSettingsScopeOf(oldObj)
	if err != nil {
		return fmt.Errorf("error getting the scope of the stored dashboard settings: %w", err)
	}
	if scope != oldScope {
		return apierrors.NewBadRequest("dashboard settings scope (grafana.app/folder annotation and spec.userUID) cannot be changed; delete it and create a new one")
	}

	name := obj.GetName()
	if err := validateDashboardSettingsMetadataName(name, scope); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	if err := validateDashboardSettingsSpec(name, obj.Spec); err != nil {
		return err
	}

	if err := b.validateDashboardSettingsAutoRefresh(obj.Spec); err != nil {
		return apierrors.NewBadRequest(err.Error())
	}

	return nil
}

func (b *DashboardsAPIBuilder) validateDashboardSettingsAutoRefresh(spec dashv2beta1.DashboardSettingsSpec) error {
	if spec.AutoRefresh == nil {
		return nil
	}
	return b.dashboardService.ValidateDashboardRefreshInterval(b.minRefreshInterval, *spec.AutoRefresh)
}

// Nothing manages dashboard settings: the authorizer denies Git Sync writes, and the storage layer
// would hand writes of a repository-managed object to the repository, out of the owner's reach.
func validateDashboardSettingsNotManaged(obj *dashv2beta1.DashboardSettings) error {
	annotations := obj.GetAnnotations()
	_, hasKind := annotations[utils.AnnoKeyManagerKind]
	_, hasIdentity := annotations[utils.AnnoKeyManagerIdentity]
	if hasKind || hasIdentity {
		return errors.New("dashboard settings can't be managed by a repository")
	}

	// Also reject anything the platform's manager accessor reports as managed.
	accessor, err := utils.MetaAccessor(obj)
	if err != nil {
		return err
	}
	if _, managed := accessor.GetManagerProperties(); managed {
		return errors.New("dashboard settings can't be managed by a repository")
	}
	return nil
}
