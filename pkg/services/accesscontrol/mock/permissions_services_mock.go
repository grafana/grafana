package mock

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

var _ accesscontrol.PermissionsServices = new(PermissionsServicesMock)

func NewPermissionsServicesMock() *PermissionsServicesMock {
	return &PermissionsServicesMock{
		teams:       &MockPermissionsService{},
		datasources: &MockPermissionsService{},
	}
}

type PermissionsServicesMock struct {
	teams       *MockPermissionsService
	datasources *MockPermissionsService
}

func (p PermissionsServicesMock) GetTeamService() accesscontrol.PermissionsService {
	return p.teams
}

func (p PermissionsServicesMock) GetDataSourceService() accesscontrol.PermissionsService {
	return p.datasources
}
