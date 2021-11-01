package database

import (
	"context"

	"github.com/grafana/grafana/pkg/services/accesscontrol/mock"
)

type MockDatasourceDatabase struct {
	mock.Mock
}

func (m *MockDatasourceDatabase) RemovePermission(ctx context.Context, orgID int64, dsID int64, permissionID int64) error {
	mockedArgs := m.Called(ctx, orgID, dsID, permissionID)
	return mockedArgs.Error(0)
}
