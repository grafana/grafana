package provisioning

import "github.com/grafana/grafana/pkg/services/provisioning/dashboards"

type Calls struct {
	ProvisionDatasources         []interface{}
	ProvisionNotifications       []interface{}
	ProvisionDashboards          []interface{}
	GetDashboardFileReaderByName []interface{}
}

type ProvisioningServiceMock struct {
	Calls                            *Calls
	ProvisionDatasourcesFunc         func() error
	ProvisionNotificationsFunc       func() error
	ProvisionDashboardsFunc          func() error
	GetDashboardFileReaderByNameFunc func(name string) *dashboards.FileReader
}

func NewProvisioningServiceMock() *ProvisioningServiceMock {
	return &ProvisioningServiceMock{
		Calls: &Calls{},
	}
}

func (mock *ProvisioningServiceMock) ProvisionDatasources() error {
	mock.Calls.ProvisionDatasources = append(mock.Calls.ProvisionDatasources, nil)
	if mock.ProvisionDatasourcesFunc != nil {
		return mock.ProvisionDatasourcesFunc()
	} else {
		return nil
	}
}

func (mock *ProvisioningServiceMock) ProvisionNotifications() error {
	mock.Calls.ProvisionNotifications = append(mock.Calls.ProvisionNotifications, nil)
	if mock.ProvisionNotificationsFunc != nil {
		return mock.ProvisionNotificationsFunc()
	} else {
		return nil
	}
}

func (mock *ProvisioningServiceMock) ProvisionDashboards() error {
	mock.Calls.ProvisionDashboards = append(mock.Calls.ProvisionDashboards, nil)
	if mock.ProvisionDashboardsFunc != nil {
		return mock.ProvisionDashboardsFunc()
	} else {
		return nil
	}
}

func (mock *ProvisioningServiceMock) GetDashboardFileReaderByName(name string) *dashboards.FileReader {
	mock.Calls.GetDashboardFileReaderByName = append(mock.Calls.GetDashboardFileReaderByName, name)
	if mock.GetDashboardFileReaderByNameFunc != nil {
		return mock.GetDashboardFileReaderByNameFunc(name)
	} else {
		return nil
	}
}
