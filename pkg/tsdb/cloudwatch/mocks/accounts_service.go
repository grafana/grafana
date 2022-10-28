package mocks

import (
	"github.com/grafana/grafana/pkg/tsdb/cloudwatch/models"
	"github.com/stretchr/testify/mock"
)

type AccountsServiceMock struct {
	mock.Mock
}

func (a *AccountsServiceMock) GetAccountsForCurrentUserOrRole() ([]models.ResourceResponse[*models.Account], error) {
	args := a.Called()

	return args.Get(0).([]models.ResourceResponse[*models.Account]), args.Error(1)
}
