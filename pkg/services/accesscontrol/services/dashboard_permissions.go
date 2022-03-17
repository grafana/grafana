package services

import (
	"context"
	"errors"
	"strconv"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type DashboardPermissions struct {
	*resourcepermissions.Service
}

var DashboardViewActions = []string{accesscontrol.ActionDashboardsRead}
var DashboardEditActions = append(DashboardViewActions, []string{accesscontrol.ActionDashboardsWrite, accesscontrol.ActionDashboardsDelete}...)
var DashboardAdminActions = append(DashboardEditActions, []string{accesscontrol.ActionDashboardsPermissionsRead, accesscontrol.ActionDashboardsPermissionsWrite}...)

func ProvideDashboardPermissions(
	cfg *setting.Cfg, router routing.RouteRegister, sql *sqlstore.SQLStore,
	ac accesscontrol.AccessControl, store resourcepermissions.Store,
) (*DashboardPermissions, error) {
	getDashboard := func(ctx context.Context, orgID int64, resourceID string) (*models.Dashboard, error) {
		id, err := strconv.ParseInt(resourceID, 10, 64)
		if err != nil {
			return nil, err
		}
		query := &models.GetDashboardQuery{Id: id, OrgId: orgID}
		if err := sql.GetDashboard(ctx, query); err != nil {
			return nil, err
		}
		return query.Result, nil
	}

	options := resourcepermissions.Options{
		Resource: "dashboards",
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			dashboard, err := getDashboard(ctx, orgID, resourceID)
			if err != nil {
				return err
			}

			if dashboard.IsFolder {
				return errors.New("not found")
			}

			return nil
		},
		UidSolver: func(ctx context.Context, orgID int64, uid string) (int64, error) {
			query := &models.GetDashboardQuery{
				Uid:   uid,
				OrgId: orgID,
			}
			if err := sql.GetDashboard(ctx, query); err != nil {
				return 0, err
			}
			return query.Result.Id, nil
		},
		InheritedScopesSolver: func(ctx context.Context, orgID int64, resourceID string) ([]string, error) {
			dashboard, err := getDashboard(ctx, orgID, resourceID)
			if err != nil {
				return nil, err
			}
			if dashboard.FolderId > 0 {
				return []string{accesscontrol.GetResourceScope("folders", strconv.FormatInt(dashboard.FolderId, 10))}, nil
			}
			return []string{}, nil
		},
		Assignments: resourcepermissions.Assignments{
			Users:        true,
			Teams:        true,
			BuiltInRoles: true,
		},
		PermissionsToActions: map[string][]string{
			"View":  DashboardViewActions,
			"Edit":  DashboardEditActions,
			"Admin": DashboardAdminActions,
		},
		ReaderRoleName: "Dashboard permission reader",
		WriterRoleName: "Dashboard permission writer",
		RoleGroup:      "Dashboards",
	}

	svc, err := resourcepermissions.New(options, cfg, router, ac, store, sql)
	if err != nil {
		return nil, err
	}
	return &DashboardPermissions{svc}, nil
}
