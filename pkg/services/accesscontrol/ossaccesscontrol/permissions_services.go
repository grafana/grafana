package ossaccesscontrol

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

func ProvidePermissionsServices(
	teamPermissions accesscontrol.TeamPermissions, folderPermissions accesscontrol.FolderPermissions,
	dashboardPermissions accesscontrol.DashboardPermissions, datasourcePermissions accesscontrol.DatasourcePermissions,
) *PermissionsServices {
	return &PermissionsServices{teamPermissions, folderPermissions, dashboardPermissions, datasourcePermissions}
}

type PermissionsServices struct {
	teams       accesscontrol.PermissionsService
	folder      accesscontrol.PermissionsService
	dashboard   accesscontrol.PermissionsService
	datasources accesscontrol.PermissionsService
}

func (s *PermissionsServices) GetTeamService() accesscontrol.PermissionsService {
	return s.teams
}

func (s *PermissionsServices) GetFolderService() accesscontrol.PermissionsService {
	return s.folder
}

func (s *PermissionsServices) GetDashboardService() accesscontrol.PermissionsService {
	return s.dashboard
}

func (s *PermissionsServices) GetDataSourceService() accesscontrol.PermissionsService {
	return s.datasources
}
