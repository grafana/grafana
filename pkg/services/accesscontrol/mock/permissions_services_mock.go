package mock

import (
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/resourcepermissions"
)

var _ accesscontrol.PermissionsServices = new(PermissionsServicesMock)

func NewPermissionsServicesMock() *PermissionsServicesMock {
	return &PermissionsServicesMock{
		teams:       &resourcepermissions.MockService{},
		datasources: &resourcepermissions.MockService{},
	}
}

type PermissionsServicesMock struct {
	teams       *resourcepermissions.MockService
	datasources *resourcepermissions.MockService
}

func (p PermissionsServicesMock) GetTeamService() accesscontrol.PermissionsService {
	return p.teams
}

func (p PermissionsServicesMock) GetDataSourceService() accesscontrol.PermissionsService {
	return p.datasources
}
