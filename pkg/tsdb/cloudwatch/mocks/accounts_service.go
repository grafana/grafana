package mocks

import (
	"context"

	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models/resources"
	"github.com/stretchr/testify/mock"
)

type AccountsServiceMock struct {
	mock.Mock
}

func (a *AccountsServiceMock) GetAccountsForCurrentUserOrRole(ctx context.Context) ([]resources.ResourceResponse[resources.Account], error) {
	args := a.Called()

	return args.Get(0).([]resources.ResourceResponse[resources.Account]), args.Error(1)
}
