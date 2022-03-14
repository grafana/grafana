package mock

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var _ accesscontrol.PermissionsServices = new(PermissionsServicesMock)

func NewPermissionsServicesMock() *PermissionsServicesMock {
	return &PermissionsServicesMock{
		Teams:       &MockPermissionsService{},
		Folders:     &MockPermissionsService{},
		Dashboards:  &MockPermissionsService{},
		Datasources: &MockPermissionsService{},
	}
}

type PermissionsServicesMock struct {
	Teams       *MockPermissionsService
	Folders     *MockPermissionsService
	Dashboards  *MockPermissionsService
	Datasources *MockPermissionsService
}

func (p PermissionsServicesMock) GetTeamService() accesscontrol.PermissionsService {
	return p.Teams
}

func (p PermissionsServicesMock) GetFolderService() accesscontrol.PermissionsService {
	return p.Folders
}

func (p PermissionsServicesMock) GetDashboardService() accesscontrol.PermissionsService {
	return p.Dashboards
}

func (p PermissionsServicesMock) GetDataSourceService() accesscontrol.PermissionsService {
	return p.Datasources
}
