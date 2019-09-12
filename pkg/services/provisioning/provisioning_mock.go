package provisioning

type Calls struct {
	ProvisionDatasources                []interface{}
	ProvisionNotifications              []interface{}
	ProvisionPlaylists                  []interface{}
	ProvisionDashboards                 []interface{}
	GetDashboardProvisionerResolvedPath []interface{}
}

type ProvisioningServiceMock struct {
	Calls                                   *Calls
	ProvisionDatasourcesFunc                func() error
	ProvisionNotificationsFunc              func() error
	ProvisionPlaylistsFunc                  func() error
	ProvisionDashboardsFunc                 func() error
	GetDashboardProvisionerResolvedPathFunc func(name string) string
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

func (mock *ProvisioningServiceMock) ProvisionPlaylists() error {
	mock.Calls.ProvisionPlaylists = append(mock.Calls.ProvisionPlaylists, nil)
	if mock.ProvisionPlaylistsFunc != nil {
		return mock.ProvisionPlaylistsFunc()
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
