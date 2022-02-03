package resourcepermissions

import (
	"context"

	"github.com/stretchr/testify/mock"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
)

type MockService struct {
	mock.Mock
}

func (m *MockService) GetPermissions(ctx context.Context, orgID int64, resourceID string) ([]accesscontrol.ResourcePermission, error) {
	mockedArgs := m.Called(ctx, orgID, resourceID)
	return mockedArgs.Get(0).([]accesscontrol.ResourcePermission), mockedArgs.Error(1)
}

func (m *MockService) SetUserPermission(ctx context.Context, orgID int64, user accesscontrol.User, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	mockedArgs := m.Called(ctx, orgID, user, resourceID, permission)
	return mockedArgs.Get(0).(*accesscontrol.ResourcePermission), mockedArgs.Error(1)
}

func (m *MockService) SetTeamPermission(ctx context.Context, orgID, teamID int64, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	mockedArgs := m.Called(ctx, orgID, teamID, resourceID, permission)
	return mockedArgs.Get(0).(*accesscontrol.ResourcePermission), mockedArgs.Error(1)
}

func (m *MockService) SetBuiltInRolePermission(ctx context.Context, orgID int64, builtInRole, resourceID, permission string) (*accesscontrol.ResourcePermission, error) {
	mockedArgs := m.Called(ctx, orgID, builtInRole, resourceID, permission)
	return mockedArgs.Get(0).(*accesscontrol.ResourcePermission), mockedArgs.Error(1)
}
