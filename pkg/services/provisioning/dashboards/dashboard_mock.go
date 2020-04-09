package dashboards

import "context"

// Calls is a mock implementation of the provisioner interface
type calls struct {
	Provision                   []interface{}
	PollChanges                 []interface{}
	GetProvisionerResolvedPath  []interface{}
	GetAllowUIUpdatesFromConfig []interface{}
}

type DashboardProvisionerMock struct {
	Calls                           *calls
	ProvisionFunc                   func() error
	PollChangesFunc                 func(ctx context.Context)
	GetProvisionerResolvedPathFunc  func(name string) string
	GetAllowUIUpdatesFromConfigFunc func(name string) bool
}

// NewDashboardProvisionerMock returns a new dashboardprovisionermock
func NewDashboardProvisionerMock() *DashboardProvisionerMock {
	return &DashboardProvisionerMock{
		Calls: &calls{},
	}
}

func (dpm *DashboardProvisionerMock) Provision() error {
	dpm.Calls.Provision = append(dpm.Calls.Provision, nil)
	if dpm.ProvisionFunc != nil {
		return dpm.ProvisionFunc()
	}
	return nil
}

func (dpm *DashboardProvisionerMock) PollChanges(ctx context.Context) {
	dpm.Calls.PollChanges = append(dpm.Calls.PollChanges, ctx)
	if dpm.PollChangesFunc != nil {
		dpm.PollChangesFunc(ctx)
	}
}

func (dpm *DashboardProvisionerMock) GetProvisionerResolvedPath(name string) string {
	dpm.Calls.GetProvisionerResolvedPath = append(dpm.Calls.GetProvisionerResolvedPath, name)
	if dpm.GetProvisionerResolvedPathFunc != nil {
		return dpm.GetProvisionerResolvedPathFunc(name)
	}
	return ""
}

func (dpm *DashboardProvisionerMock) GetAllowUIUpdatesFromConfig(name string) bool {
	dpm.Calls.GetAllowUIUpdatesFromConfig = append(dpm.Calls.GetAllowUIUpdatesFromConfig, name)
	if dpm.GetAllowUIUpdatesFromConfigFunc != nil {
		return dpm.GetAllowUIUpdatesFromConfigFunc(name)
	}
	return false
}
