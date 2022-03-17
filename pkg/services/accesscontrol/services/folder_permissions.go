package services

import (
	"context"
	"errors"
	"strconv"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/setting"
)

type FolderPermissions struct {
	*resourcepermissions.Service
}

var FolderViewActions = []string{dashboards.ActionFoldersRead}
var FolderEditActions = append(FolderViewActions, []string{dashboards.ActionFoldersWrite, dashboards.ActionFoldersDelete, accesscontrol.ActionDashboardsCreate}...)
var FolderAdminActions = append(FolderEditActions, []string{dashboards.ActionFoldersPermissionsRead, dashboards.ActionFoldersPermissionsWrite}...)

func ProvideFolderPermissions(
	cfg *setting.Cfg, router routing.RouteRegister, sql *sqlstore.SQLStore,
	accesscontrol accesscontrol.AccessControl, store resourcepermissions.Store,
) (*FolderPermissions, error) {
	options := resourcepermissions.Options{
		Resource: "folders",
		ResourceValidator: func(ctx context.Context, orgID int64, resourceID string) error {
			id, err := strconv.ParseInt(resourceID, 10, 64)
			if err != nil {
				return err
			}
			query := &models.GetDashboardQuery{Id: id, OrgId: orgID}
			if err := sql.GetDashboard(ctx, query); err != nil {
				return err
			}

			if !query.Result.IsFolder {
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
		Assignments: resourcepermissions.Assignments{
			Users:        true,
			Teams:        true,
			BuiltInRoles: true,
		},
		PermissionsToActions: map[string][]string{
			"View":  append(DashboardViewActions, FolderViewActions...),
			"Edit":  append(DashboardEditActions, FolderEditActions...),
			"Admin": append(DashboardAdminActions, FolderAdminActions...),
		},
		ReaderRoleName: "Folder permission reader",
		WriterRoleName: "Folder permission writer",
		RoleGroup:      "Folders",
	}

	svc, err := resourcepermissions.New(options, cfg, router, accesscontrol, store, sql)
	if err != nil {
		return nil, err
	}
	return &FolderPermissions{svc}, err
}
