package mock

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var _ accesscontrol.PermissionsServices = new(PermissionsServicesMock)

func NewPermissionsServicesMock() *PermissionsServicesMock {
	return &PermissionsServicesMock{
		teams:       &MockPermissionsService{},
		folders:     &MockPermissionsService{},
		dashboards:  &MockPermissionsService{},
		datasources: &MockPermissionsService{},
	}
}

type PermissionsServicesMock struct {
	teams       *MockPermissionsService
	folders     *MockPermissionsService
	dashboards  *MockPermissionsService
	datasources *MockPermissionsService
}

func (p PermissionsServicesMock) GetTeamService() accesscontrol.PermissionsService {
	return p.teams
}

func (p PermissionsServicesMock) GetFolderService() accesscontrol.PermissionsService {
	return p.folders
}

func (p PermissionsServicesMock) GetDashboardService() accesscontrol.PermissionsService {
	return p.dashboards
}

func (p PermissionsServicesMock) GetDataSourceService() accesscontrol.PermissionsService {
	return p.datasources
}
