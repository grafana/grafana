package provisioning

type Calls struct {
	ProvisionDatasources                []interface{}
	ProvisionNotifications              []interface{}
	ProvisionDashboards                 []interface{}
	GetDashboardProvisionerResolvedPath []interface{}
	GetAllowUIUpdatesFromConfig         []interface{}
}

type ProvisioningServiceMock struct {
	Calls                                   *Calls
	ProvisionDatasourcesFunc                func() error
	ProvisionNotificationsFunc              func() error
	ProvisionDashboardsFunc                 func() error
	GetDashboardProvisionerResolvedPathFunc func(name string) string
	GetAllowUIUpdatesFromConfigFunc         func(name string) bool
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
	}
	return nil
}

func (mock *ProvisioningServiceMock) ProvisionNotifications() error {
	mock.Calls.ProvisionNotifications = append(mock.Calls.ProvisionNotifications, nil)
	if mock.ProvisionNotificationsFunc != nil {
		return mock.ProvisionNotificationsFunc()
	}
	return nil
}

func (mock *ProvisioningServiceMock) ProvisionDashboards() error {
	mock.Calls.ProvisionDashboards = append(mock.Calls.ProvisionDashboards, nil)
	if mock.ProvisionDashboardsFunc != nil {
		return mock.ProvisionDashboardsFunc()
	}
	return nil
}

func (mock *ProvisioningServiceMock) GetDashboardProvisionerResolvedPath(name string) string {
	mock.Calls.GetDashboardProvisionerResolvedPath = append(mock.Calls.GetDashboardProvisionerResolvedPath, name)
	if mock.GetDashboardProvisionerResolvedPathFunc != nil {
		return mock.GetDashboardProvisionerResolvedPathFunc(name)
	}
	return ""
}

func (mock *ProvisioningServiceMock) GetAllowUIUpdatesFromConfig(name string) bool {
	mock.Calls.GetAllowUIUpdatesFromConfig = append(mock.Calls.GetAllowUIUpdatesFromConfig, name)
	if mock.GetAllowUIUpdatesFromConfigFunc != nil {
		return mock.GetAllowUIUpdatesFromConfigFunc(name)
	}
	return false
}
