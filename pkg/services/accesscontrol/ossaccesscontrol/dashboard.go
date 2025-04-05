package ossaccesscontrol

import (
	"context"
	"errors"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/licensing"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

type DashboardPermissionsService struct {
	*resourcepermissions.Service
}

var DashboardViewActions = []string{dashboards.ActionDashboardsRead}
var DashboardEditActions = append(DashboardViewActions, []string{dashboards.ActionDashboardsWrite, dashboards.ActionDashboardsDelete}...)
var DashboardAdminActions = append(DashboardEditActions, []string{dashboards.ActionDashboardsPermissionsRead, dashboards.ActionDashboardsPermissionsWrite}...)

func getDashboardViewActions(features featuremgmt.FeatureToggles) []string {
	if features.IsEnabled(context.Background(), featuremgmt.FlagAnnotationPermissionUpdate) {
		return append(DashboardViewActions, accesscontrol.ActionAnnotationsRead)
	}
	return DashboardViewActions
}

func getDashboardEditActions(features featuremgmt.FeatureToggles) []string {
	if features.IsEnabled(context.Background(), featuremgmt.FlagAnnotationPermissionUpdate) {
		return append(DashboardEditActions, []string{accesscontrol.ActionAnnotationsRead, accesscontrol.ActionAnnotationsWrite, accesscontrol.ActionAnnotationsDelete, accesscontrol.ActionAnnotationsCreate}...)
	}
	return DashboardEditActions
}

func getDashboardAdminActions(features featuremgmt.FeatureToggles) []string {
	if features.IsEnabled(context.Background(), featuremgmt.FlagAnnotationPermissionUpdate) {
		return append(DashboardAdminActions, []string{accesscontrol.ActionAnnotationsRead, accesscontrol.ActionAnnotationsWrite, accesscontrol.ActionAnnotationsDelete, accesscontrol.ActionAnnotationsCreate}...)
	}
	return DashboardAdminActions
}

func registerDashboardRoles(cfg *setting.Cfg, features featuremgmt.FeatureToggles, service accesscontrol.Service) error {
	if !cfg.RBAC.PermissionsWildcardSeed("dashboard") {
		return nil
	}

	viewer := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:dashboards:viewer",
			DisplayName: "Viewer",
			Description: "View all dashboards",
			Group:       "Dashboards",
			Permissions: accesscontrol.PermissionsForActions(getDashboardViewActions(features), dashboards.ScopeDashboardsAll),
			Hidden:      true,
		},
		Grants: []string{"Viewer"},
	}

	editor := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:dashboards:editor",
			DisplayName: "Editor",
			Description: "Edit all dashboards.",
			Group:       "Dashboards",
			Permissions: accesscontrol.PermissionsForActions(getDashboardEditActions(features), dashboards.ScopeDashboardsAll),
			Hidden:      true,
		},
		Grants: []string{"Editor"},
	}

	admin := accesscontrol.RoleRegistration{
		Role: accesscontrol.RoleDTO{
			Name:        "fixed:dashboards:admin",
			DisplayName: "Admin",
			Description: "Administer all dashboards.",
			Group:       "Dashboards",
			Permissions: accesscontrol.PermissionsForActions(getDashboardAdminActions(features), dashboards.ScopeDashboardsAll),
			Hidden:      true,
		},
		Grants: []string{"Admin"},
	}

	return service.DeclareFixedRoles(viewer, editor, admin)
}

func ProvideDashboardPermissions(
	cfg *setting.Cfg, features featuremgmt.FeatureToggles, router routing.RouteRegister, sql db.DB, ac accesscontrol.AccessControl,
	license licensing.Licensing, dashboardService dashboards.DashboardService, folderService folder.Service, service accesscontrol.Service,
	teamService team.Service, userService user.Service, actionSetService resourcepermissions.ActionSetService,
	dashboardPermissionsRegistration dashboards.PermissionsRegistrationService,
) (*DashboardPermissionsService, error) {
	getDashboard := func(ctx context.Context, orgID int64, resourceID string) (*dashboards.Dashboard, error) {
		query := &dashboards.GetDashboardQuery{UID: resourceID, OrgID: orgID}
		queryResult, err := dashboardService.GetDashboard(ctx, query)
		if err != nil {
			return nil, err
		}
		return queryResult, nil
	}

	if err := registerDashboardRoles(cfg, features, service); err != nil {
		return nil, err
	}

	options := resourcepermissions.Options{
		Resource:          "dashboards",
		ResourceAttribute: "uid",
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			ctx, span := tracer.Start(ctx, "accesscontrol.ossaccesscontrol.ProvideDashboardPermissions.ResourceValidator")
			defer span.End()

			ctx, _ = identity.WithServiceIdentity(ctx, orgID)
			dashboard, err := getDashboard(ctx, orgID, resourceID)
			if err != nil {
				return err
			}

			if dashboard.IsFolder {
				return errors.New("not found")
			}

			return nil
		},
		InheritedScopesSolver: func(ctx context.Context, orgID int64, resourceID string) ([]string, error) {
			ctx, _ = identity.WithServiceIdentity(ctx, orgID)
			dashboard, err := getDashboard(ctx, orgID, resourceID)
			if err != nil {
				return nil, err
			}

			scopes := []string(accesscontrol.WildcardsFromPrefix(dashboards.ScopeFoldersPrefix))
			metrics.MFolderIDsServiceCount.WithLabelValues(metrics.AccessControl).Inc()
			if dashboard.FolderUID != "" {
				nestedScopes, err := dashboards.GetInheritedScopes(ctx, orgID, dashboard.FolderUID, folderService)
				if err != nil {
					return nil, err
				}

				scopes = append(scopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(dashboard.FolderUID))
				scopes = append(scopes, nestedScopes...)
				return scopes, nil
			}

			return append(scopes, dashboards.ScopeFoldersProvider.GetResourceScopeUID(folder.GeneralFolderUID)), nil
		},
		Assignments: resourcepermissions.Assignments{
			Users:           true,
			Teams:           true,
			BuiltInRoles:    true,
			ServiceAccounts: true,
		},
		PermissionsToActions: map[string][]string{
			"View":  getDashboardViewActions(features),
			"Edit":  getDashboardEditActions(features),
			"Admin": getDashboardAdminActions(features),
		},
		ReaderRoleName: "Permission reader",
		WriterRoleName: "Permission writer",
		RoleGroup:      "Dashboards",
	}

	srv, err := resourcepermissions.New(cfg, options, features, router, license, ac, service, sql, teamService, userService, actionSetService)
	if err != nil {
		return nil, err
	}
	s := &DashboardPermissionsService{srv}
	dashboardPermissionsRegistration.RegisterDashboardPermissions(s)
	return s, nil
}
