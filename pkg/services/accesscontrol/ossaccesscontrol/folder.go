package ossaccesscontrol

import (
	"context"
	"errors"

	folderv1 "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/apiserver"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type FolderPermissionsService struct {
	*resourcepermissions.Service
}

var ErrFolderUnhandledError = errutil.Internal("folder.unhandled-error", errutil.WithPublicMessage("Unhandled folder error"))

var FolderViewActions = []string{folder.ActionFoldersRead, accesscontrol.ActionAlertingRuleRead, libraryelements.ActionLibraryPanelsRead, accesscontrol.ActionAlertingSilencesRead}
var FolderEditActions = append(FolderViewActions, []string{
	folder.ActionFoldersWrite,
	folder.ActionFoldersDelete,
	dashboards.ActionDashboardsCreate,
	accesscontrol.ActionAlertingRuleCreate,
	accesscontrol.ActionAlertingRuleUpdate,
	accesscontrol.ActionAlertingRuleDelete,
	accesscontrol.ActionAlertingSilencesCreate,
	accesscontrol.ActionAlertingSilencesWrite,
	libraryelements.ActionLibraryPanelsCreate,
	libraryelements.ActionLibraryPanelsWrite,
	libraryelements.ActionLibraryPanelsDelete,
}...)
var FolderAdminActions = append(FolderEditActions, []string{folder.ActionFoldersPermissionsRead, folder.ActionFoldersPermissionsWrite}...)

// FolderFixedRoleRegistrations returns the wildcard seed role registrations for
// folders. When wildcardSeed is false an empty slice is returned (the feature
// is disabled for this instance).
func FolderFixedRoleRegistrations(wildcardSeed bool) []accesscontrol.RoleRegistration {
	if !wildcardSeed {
		return nil
	}

	viewer := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:folders:viewer",
			DisplayName: "Viewer",
			Description: "View all folders and dashboards.",
			Group:       "Folders",
			Permissions: accesscontrol.PermissionsForActions(append(DashboardViewActions, FolderViewActions...), folder.ScopeFoldersAll),
			Hidden:      true,
		},
		Grants: []string{"Viewer"},
	}

	editor := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:folders:editor",
			DisplayName: "Editor",
			Description: "Edit all folders and dashboards.",
			Group:       "Folders",
			Permissions: accesscontrol.PermissionsForActions(append(DashboardEditActions, FolderEditActions...), folder.ScopeFoldersAll),
			Hidden:      true,
		},
		Grants: []string{"Editor"},
	}

	admin := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:folders:admin",
			DisplayName: "Admin",
			Description: "Administer all folders and dashboards",
			Group:       "folders",
			Permissions: accesscontrol.PermissionsForActions(append(DashboardAdminActions, FolderAdminActions...), folder.ScopeFoldersAll),
			Hidden:      true,
		},
		Grants: []string{"Admin"},
	}

	return []accesscontrol.RoleRegistration{viewer, editor, admin}
}

// FolderSelfReadRoleRegistration registers folders.self:read for permission validation without
// granting it to any built-in role. It exists purely so the permission registry knows the action
// and its valid scope prefix (folders:uid:): DeclareFixedRoles only calls RegisterPermission for
// actions that appear in a *declared* fixed role's permission list, and folders.self:read is
// deliberately excluded from FolderViewActions/FolderEditActions/FolderAdminActions -- bundling it
// there would grant it to every Viewer by default, defeating the point of a self-only,
// individually assignable action. The only supported way a user gets this action is an explicit
// custom-role assignment naming a specific folder (identity-access-team#2285, Phase 1).
//
// Without this registration, enterprise custom-role validation (ValidateProvidedPermissions, when
// cfg.RBAC.PermissionValidationEnabled) rejects folders.self:read as an unknown action -- see
// permreg.TestPermissionRegistry_FolderSelfReadRegistrationGap for the empirical demonstration.
func FolderSelfReadRoleRegistration() accesscontrol.RoleRegistration {
	return accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:folders:self-reader",
			DisplayName: "Folder self-reader (internal)",
			Description: "Registers folders.self:read for custom-role permission validation. Not granted to any basic role.",
			Group:       "Folders",
			Permissions: accesscontrol.PermissionsForActions([]string{folder.ActionFoldersReadSelf}, folder.ScopeFoldersAll),
			Hidden:      true,
		},
		Grants: []string{},
	}
}

func registerFolderRoles(cfg *setting.Cfg, _ featuremgmt.FeatureToggles, service accesscontrol.Service) error {
	registrations := append(FolderFixedRoleRegistrations(cfg.RBAC.PermissionsWildcardSeed("folder")), FolderSelfReadRoleRegistration())
	return service.DeclareFixedRoles(registrations...)
}

// FolderPermissionsRoleRegistrations returns the templated reader/writer fixed
// roles for folder resource permissions (fixed:folders.permissions:reader and
// :writer). These mirror the roles declared by ProvideFolderPermissions through
// resourcepermissions.New; the identity fields below must match the Options
// passed there.
func FolderPermissionsRoleRegistrations() []accesscontrol.RoleRegistration {
	return resourcepermissions.FixedRoleRegistrations(resourcepermissions.Options{
		Resource:       folderPermissionsResource,
		APIGroup:       folderv1.APIGroup,
		ReaderRoleName: permissionReaderRoleName,
		WriterRoleName: permissionWriterRoleName,
		RoleGroup:      folderPermissionsRoleGroup,
	})
}

func ProvideFolderPermissions(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, router routing.RouteRegister, sql db.DB, accesscontrol accesscontrol.AccessControl,
	license licensing.Licensing, folderService folder.Service, service accesscontrol.Service,
	teamService team.Service, userService user.Service, actionSetService resourcepermissions.ActionSetService,
	restConfigProvider apiserver.DirectRestConfigProvider,
) (*FolderPermissionsService, error) {
	if err := registerFolderRoles(cfg, features, service); err != nil {
		return nil, err
	}

	options := resourcepermissions.Options{
		Resource:          folderPermissionsResource,
		ResourceAttribute: "uid",
		APIGroup:          folderv1.APIGroup,
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			ctx, span := tracer.Start(ctx, "accesscontrol.ossaccesscontrol.ProvideFolderPermissions.ResourceValidator")
			defer span.End()

			ctx, ident := identity.WithServiceIdentity(ctx, orgID)
			_, err := folderService.Get(ctx, &folder.GetFolderQuery{
				UID:          &resourceID,
				OrgID:        orgID,
				SignedInUser: ident,
			})

			if err != nil {
				switch {
				case func() bool {
					var errUtilErr errutil.Error
					return errors.As(err, &errUtilErr)
				}():
					return err
				case errors.Is(err, dashboards.ErrFolderNotFound):
					return folder.ErrFolderNotFound.Errorf("folder not found")
				}
				return ErrFolderUnhandledError.Errorf("unhandled folder error: %w", err)
			}

			return nil
		},
		InheritedScopesSolver: func(ctx context.Context, orgID int64, resourceID string) ([]string, error) {
			ctx, _ = identity.WithServiceIdentity(ctx, orgID)
			return folder.GetInheritedScopes(ctx, orgID, resourceID, folderService)
		},
		Assignments: resourcepermissions.Assignments{
			Users:           true,
			Teams:           true,
			BuiltInRoles:    true,
			ServiceAccounts: true,
		},
		PermissionsToActions: map[string][]string{
			"View":  append(DashboardViewActions, FolderViewActions...),
			"Edit":  append(DashboardEditActions, FolderEditActions...),
			"Admin": append(DashboardAdminActions, FolderAdminActions...),
		},
		ReaderRoleName:     permissionReaderRoleName,
		WriterRoleName:     permissionWriterRoleName,
		RoleGroup:          folderPermissionsRoleGroup,
		RestConfigProvider: restConfigProvider,
	}
	srv, err := resourcepermissions.New(cfg, options, features, router, license, accesscontrol, service, sql, teamService, userService, actionSetService)
	if err != nil {
		return nil, err
	}
	return &FolderPermissionsService{srv}, nil
}
